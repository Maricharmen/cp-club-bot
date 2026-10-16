const {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const students = require('../services/students');
const sessions = require('../services/sessions');
const sessionRecords = require('../services/sessionRecords');
const { fetchRecentSubmissions } = require('../services/codeforces');
const { parseProblemCodes, collectAcceptedProblems } = require('../domain/codeforces');
const { parseStandings } = require('../domain/standings');
const { belongsToGroup, normalizeGroup, partitionResultsByGroup, resolveGroup } = require('../domain/groups');
const { replyWithPages } = require('../utils/interactions');
const { formatCodeList } = require('../utils/text');

const DEFAULT_CF_POINTS = 10.0;
const DEFAULT_STANDINGS_POINTS = 20.0;
const STANDINGS_MODAL_PREFIX = 'modal_standings_';
const MODAL_TITLE_MAX_LENGTH = 45;
const AUTOCOMPLETE_MAX_CHOICES = 25;
// Pausa de cortesía entre llamadas a la API pública de Codeforces.
const CODEFORCES_DELAY_MS = 200;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Valida el grupo pedido contra los grupos de la base. Sin grupo, la
// importación aplica a todos los estudiantes (comportamiento original).
async function resolveRequestedGroup(input) {
  if (!input?.trim()) return { group: null };

  const { data: groups, error } = await students.listActiveGroups();
  if (error) throw error;

  const group = resolveGroup(input, groups);
  if (!group) {
    return {
      errorMessage: `❌ El grupo \`${input.trim()}\` no existe. Grupos disponibles: ${formatCodeList(groups, 500) || '_ninguno_'}`
    };
  }
  return { group };
}

function groupLine(group) {
  return group ? `**Grupo:** \`${group}\`\n` : '';
}

// Autocompletado de la opción `grupo` con los grupos de los estudiantes activos.
async function handleGroupAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'grupo') return interaction.respond([]);

  const { data: groups, error } = await students.listActiveGroups();
  if (error) throw error;

  const query = normalizeGroup(focused.value);
  return interaction.respond(
    groups
      .filter(group => normalizeGroup(group).includes(query))
      .slice(0, AUTOCOMPLETE_MAX_CHOICES)
      .map(group => ({ name: group, value: group }))
  );
}

// /sincronizar-codeforces
async function handleCodeforcesSyncCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const sesionId = interaction.options.getInteger('sesion_id');
  const contestId = interaction.options.getInteger('contest_id');
  const problemasInput = interaction.options.getString('problemas');
  const puntosPorProblema = interaction.options.getNumber('puntos_por_problema') || DEFAULT_CF_POINTS;

  if (!contestId && !problemasInput) {
    return interaction.editReply('❌ Debes ingresar al menos un `contest_id` o una lista de `problemas` (ej. `106540G, 106540A`).');
  }

  const { group, errorMessage } = await resolveRequestedGroup(interaction.options.getString('grupo'));
  if (errorMessage) return interaction.editReply(errorMessage);

  const { data: sesion, error: errSes } = await sessions.findSessionById(sesionId, 'id, nombre, programa');
  if (errSes || !sesion) {
    return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
  }

  const { data: todos, error: errEst } = await students.listActiveStudentsWithHandle();
  if (errEst) throw errEst;

  // Con grupo solo se consulta Codeforces para los estudiantes de ese grupo.
  const estudiantes = group ? todos.filter(est => belongsToGroup(est, group)) : todos;
  if (estudiantes.length === 0) {
    return interaction.editReply(group
      ? `⚠️ No hay estudiantes activos con handle de Codeforces en el grupo \`${group}\`.`
      : '⚠️ No hay estudiantes con handle de Codeforces activo en la base de datos.');
  }

  const criterios = { contestId, problemCodes: parseProblemCodes(problemasInput) };
  const actualizados = [];
  const fallidos = [];

  for (const est of estudiantes) {
    const handle = est.codeforces_handle.trim();
    try {
      const submissions = await fetchRecentSubmissions(handle);
      const problemasAprobados = collectAcceptedProblems(submissions, criterios);

      if (problemasAprobados.size > 0) {
        const totalAC = problemasAprobados.size;
        const puntajeTotal = totalAC * puntosPorProblema;
        const listaNombres = [...problemasAprobados].join(', ');

        const { error: errUpsert } = await sessionRecords.saveScore({
          sessionId: sesion.id,
          studentId: est.id,
          score: puntajeTotal,
          feedback: `Práctica CF: ${totalAC} AC (${listaNombres})`
        });
        if (errUpsert) throw errUpsert;

        actualizados.push({ nombre: est.nombre, handle, ac: totalAC, problemas: listaNombres, puntos: puntajeTotal });
      }
    } catch (error) {
      console.error(`Error sincronizando handle ${handle}:`, error);
      fallidos.push(handle);
    }

    await sleep(CODEFORCES_DELAY_MS);
  }

  const avisoFallidos = fallidos.length > 0
    ? `\n**⚠️ No se pudieron procesar (${fallidos.length}):** ${formatCodeList(fallidos, 450)}`
    : '';

  if (actualizados.length === 0) {
    return interaction.editReply(
      `⚠️ No se encontraron envíos con veredicto \`OK\` para los criterios indicados entre los estudiantes ${group ? `del grupo \`${group}\`` : 'registrados'}.${avisoFallidos}`
    );
  }

  const criterio = [
    contestId ? `Contest \`#${contestId}\`` : null,
    problemasInput ? `Problemas: \`${problemasInput}\`` : null
  ].filter(Boolean).join(' ');

  const lineas = actualizados.map(
    a => `• **${a.nombre}** (\`@${a.handle}\`) ➔ **${a.ac} AC** [${a.problemas}] (\`${a.puntos.toFixed(1)} pts\`)`
  );

  return replyWithPages(interaction, lineas, (texto, pagina, totalPaginas) => new EmbedBuilder()
    .setTitle('⚡ Sincronización de Codeforces Exitosa')
    .setColor(0x00A86B)
    .setDescription(
      `**Sesión:** ${sesion.nombre} (ID: \`${sesion.id}\`)\n` +
      groupLine(group) +
      `**Criterio:** ${criterio}\n` +
      `**Puntaje:** \`${puntosPorProblema} pts por problema resuelto\`\n` +
      `**Alumnos Evaluados:** \`${actualizados.length}\`${avisoFallidos}\n` +
      `**Página:** \`${pagina}/${totalPaginas}\`\n\n` +
      texto
    )
    .setFooter({ text: 'Codeforces Submissions Sync' })
    .setTimestamp());
}

function buildStandingsModalId(sesionId, puntos, group) {
  return `${STANDINGS_MODAL_PREFIX}${sesionId}_${puntos}_${encodeURIComponent(group || '')}`;
}

function parseStandingsModalId(customId) {
  const [sesionIdStr, puntosStr, ...groupParts] = customId.slice(STANDINGS_MODAL_PREFIX.length).split('_');
  return {
    sesionId: Number.parseInt(sesionIdStr, 10),
    puntosPorProblema: Number.parseFloat(puntosStr),
    requestedGroup: decodeURIComponent(groupParts.join('_')) || null
  };
}

// /importar-standings: abre el modal donde se pega la tabla.
async function handleImportStandingsCommand(interaction) {
  const sesionId = interaction.options.getInteger('sesion_id');
  const puntos = interaction.options.getNumber('puntos_por_problema') || DEFAULT_STANDINGS_POINTS;
  // El grupo se valida al enviar el modal: showModal debe ser la primera respuesta.
  const grupo = interaction.options.getString('grupo')?.trim() || null;

  const titulo = `Importar Standings (Sesión #${sesionId}${grupo ? ` · ${grupo}` : ''})`;
  const modal = new ModalBuilder()
    .setCustomId(buildStandingsModalId(sesionId, puntos, grupo))
    .setTitle(titulo.slice(0, MODAL_TITLE_MAX_LENGTH));

  const inputTexto = new TextInputBuilder()
    .setCustomId('standings_raw_text')
    .setLabel('Pega aquí las filas de la tabla de Standings')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('1   Maricharmen   1   0   +\nMaricharmen 1\nJuanPerez 3')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(inputTexto));
  return interaction.showModal(modal);
}

function formatOtherGroupList(otherGroup, maxChars) {
  return formatCodeList(
    otherGroup.map(({ student }) => `${student.codeforces_handle.trim()} → ${student.grupo || 'sin grupo'}`),
    maxChars
  );
}

// Envío del modal de /importar-standings.
async function handleStandingsModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { sesionId, puntosPorProblema, requestedGroup } = parseStandingsModalId(interaction.customId);
  const textoRaw = interaction.fields.getTextInputValue('standings_raw_text');

  const { group, errorMessage } = await resolveRequestedGroup(requestedGroup);
  if (errorMessage) return interaction.editReply(errorMessage);

  const { data: sesion, error: errSes } = await sessions.findSessionById(sesionId, 'id, nombre, programa');
  if (errSes || !sesion) {
    return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
  }

  const { data: estudiantes, error: errEst } = await students.listActiveStudentsWithHandle();
  if (errEst || !estudiantes || estudiantes.length === 0) {
    return interaction.editReply('⚠️ No hay estudiantes con handle de Codeforces en la base de datos.');
  }

  // Se busca contra todos los estudiantes para poder avisar si un handle
  // pertenece a otro grupo, en lugar de reportarlo como inexistente.
  const { results, unmatchedHandles } = parseStandings(textoRaw, estudiantes);
  const { inGroup, otherGroup } = group
    ? partitionResultsByGroup(results, group)
    : { inGroup: results, otherGroup: [] };

  const actualizados = [];
  for (const { student, accepted } of inGroup) {
    const puntosFinales = accepted * puntosPorProblema;

    const { error: errUpsert } = await sessionRecords.saveScore({
      sessionId: sesion.id,
      studentId: student.id,
      score: puntosFinales,
      feedback: `Práctica: ${accepted} AC resueltos (${puntosFinales.toFixed(1)} pts)${group ? ` · ${group}` : ''}`
    });
    if (errUpsert) throw errUpsert;

    actualizados.push({ nombre: student.nombre, handle: student.codeforces_handle, ac: accepted, puntos: puntosFinales });
  }

  if (actualizados.length === 0) {
    const detalles = [
      unmatchedHandles.length > 0 ? `**Handles no encontrados (${unmatchedHandles.length}):** ${formatCodeList(unmatchedHandles, 700)}` : null,
      otherGroup.length > 0 ? `**De otro grupo (${otherGroup.length}):** ${formatOtherGroupList(otherGroup, 700)}` : null
    ].filter(Boolean);
    return interaction.editReply(
      `⚠️ No se encontró ningún estudiante ${group ? `del grupo \`${group}\` ` : ''}vinculado en el texto ingresado.\n` +
      'Verifica que los handles coincidan con los registrados con `/vincular`.' +
      (detalles.length > 0 ? `\n${detalles.join('\n')}` : '')
    );
  }

  const lineas = actualizados.map(
    a => `• **${a.nombre}** (\`@${a.handle}\`) ➔ **${a.ac} AC** (\`${a.puntos.toFixed(1)} pts\`)`
  );
  const avisos = [
    unmatchedHandles.length > 0 ? `**No encontrados:** \`${unmatchedHandles.length}\`` : null,
    otherGroup.length > 0 ? `**De otro grupo:** \`${otherGroup.length}\`` : null
  ].filter(Boolean);
  const resumenAvisos = avisos.length > 0 ? `${avisos.join(' · ')} (lista al final)\n` : '';

  await replyWithPages(interaction, lineas, (texto, pagina, totalPaginas) => new EmbedBuilder()
    .setTitle('⚡ Standings Importados Exitosamente')
    .setColor(0x00A86B)
    .setDescription(
      `**Sesión:** ${sesion.nombre} (ID: \`${sesion.id}\`)\n` +
      groupLine(group) +
      `**Factor:** \`${puntosPorProblema} pts por problema resuelto\`\n` +
      `**Resultados Procesados:** \`${actualizados.length}\`\n` +
      resumenAvisos +
      `**Página:** \`${pagina}/${totalPaginas}\`\n\n` +
      texto
    )
    .setFooter({ text: 'CPC Concurso Sync • Standings Parser' })
    .setTimestamp());

  if (unmatchedHandles.length > 0 || otherGroup.length > 0) {
    await interaction.followUp({
      embeds: [buildSkippedEmbed(unmatchedHandles, otherGroup, group)],
      flags: MessageFlags.Ephemeral
    });
  }
}

// Filas del texto pegado que no se calificaron: handles que no corresponden a
// ningún estudiante activo y, si se indicó grupo, estudiantes de otro grupo.
function buildSkippedEmbed(unmatchedHandles, otherGroup, group) {
  const secciones = [];

  if (unmatchedHandles.length > 0) {
    secciones.push(
      `**Handles no encontrados (${unmatchedHandles.length})**\n` +
      'No coinciden con ningún estudiante activo (no se ha vinculado con `/vincular`, registró otro handle o no tiene status ACTIVO).\n' +
      formatCodeList(unmatchedHandles, 1700)
    );
  }

  if (otherGroup.length > 0) {
    secciones.push(
      `**De otro grupo (${otherGroup.length})**\n` +
      `Son estudiantes registrados, pero no pertenecen a \`${group}\`. Califícalos con la importación de su grupo.\n` +
      formatOtherGroupList(otherGroup, 1700)
    );
  }

  const total = unmatchedHandles.length + otherGroup.length;
  return new EmbedBuilder()
    .setTitle(`⚠️ Filas no calificadas (${total})`)
    .setColor(0xE67E22)
    .setDescription(secciones.join('\n\n'))
    .setFooter({ text: 'CPC Concurso Sync • Standings Parser' })
    .setTimestamp();
}

module.exports = {
  commands: {
    'sincronizar-codeforces': handleCodeforcesSyncCommand,
    'importar-standings': handleImportStandingsCommand
  },
  autocomplete: {
    'sincronizar-codeforces': handleGroupAutocomplete,
    'importar-standings': handleGroupAutocomplete
  },
  modals: [
    { matches: customId => customId.startsWith(STANDINGS_MODAL_PREFIX), handle: handleStandingsModal }
  ],
  // Exportados para pruebas.
  buildStandingsModalId,
  parseStandingsModalId
};
