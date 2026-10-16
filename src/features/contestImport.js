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
const { replyWithPages } = require('../utils/interactions');

const DEFAULT_CF_POINTS = 10.0;
const DEFAULT_STANDINGS_POINTS = 20.0;
const STANDINGS_MODAL_PREFIX = 'modal_standings_';
// Pausa de cortesía entre llamadas a la API pública de Codeforces.
const CODEFORCES_DELAY_MS = 200;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

  const { data: sesion, error: errSes } = await sessions.findSessionById(sesionId, 'id, nombre, programa');
  if (errSes || !sesion) {
    return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
  }

  const { data: estudiantes, error: errEst } = await students.listActiveStudentsWithHandle();
  if (errEst || !estudiantes || estudiantes.length === 0) {
    return interaction.editReply('⚠️ No hay estudiantes con handle de Codeforces activo en la base de datos.');
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
    ? `\n**⚠️ No se pudieron procesar (${fallidos.length}):** ${fallidos.map(h => `\`${h}\``).join(', ')}`.slice(0, 500)
    : '';

  if (actualizados.length === 0) {
    return interaction.editReply(
      `⚠️ No se encontraron envíos con veredicto \`OK\` para los criterios indicados entre los estudiantes registrados.${avisoFallidos}`
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
      `**Criterio:** ${criterio}\n` +
      `**Puntaje:** \`${puntosPorProblema} pts por problema resuelto\`\n` +
      `**Alumnos Evaluados:** \`${actualizados.length}\`${avisoFallidos}\n` +
      `**Página:** \`${pagina}/${totalPaginas}\`\n\n` +
      texto
    )
    .setFooter({ text: 'Codeforces Submissions Sync' })
    .setTimestamp());
}

// /importar-standings: abre el modal donde se pega la tabla.
async function handleImportStandingsCommand(interaction) {
  const sesionId = interaction.options.getInteger('sesion_id');
  const puntos = interaction.options.getNumber('puntos_por_problema') || DEFAULT_STANDINGS_POINTS;

  const modal = new ModalBuilder()
    .setCustomId(`${STANDINGS_MODAL_PREFIX}${sesionId}_${puntos}`)
    .setTitle(`Importar Standings (Sesión #${sesionId})`);

  const inputTexto = new TextInputBuilder()
    .setCustomId('standings_raw_text')
    .setLabel('Pega aquí las filas de la tabla de Standings')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('1   Maricharmen   1   0   +\nMaricharmen 1\nJuanPerez 3')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(inputTexto));
  return interaction.showModal(modal);
}

// Envío del modal de /importar-standings.
async function handleStandingsModal(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [sesionIdStr, puntosStr] = interaction.customId.slice(STANDINGS_MODAL_PREFIX.length).split('_');
  const sesionId = Number.parseInt(sesionIdStr, 10);
  const puntosPorProblema = Number.parseFloat(puntosStr);
  const textoRaw = interaction.fields.getTextInputValue('standings_raw_text');

  const { data: sesion, error: errSes } = await sessions.findSessionById(sesionId, 'id, nombre, programa');
  if (errSes || !sesion) {
    return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
  }

  const { data: estudiantes, error: errEst } = await students.listActiveStudentsWithHandle();
  if (errEst || !estudiantes || estudiantes.length === 0) {
    return interaction.editReply('⚠️ No hay estudiantes con handle de Codeforces en la base de datos.');
  }

  const actualizados = [];
  for (const { student, accepted } of parseStandings(textoRaw, estudiantes)) {
    const puntosFinales = accepted * puntosPorProblema;

    const { error: errUpsert } = await sessionRecords.saveScore({
      sessionId: sesion.id,
      studentId: student.id,
      score: puntosFinales,
      feedback: `Práctica: ${accepted} AC resueltos (${puntosFinales.toFixed(1)} pts)`
    });
    if (errUpsert) throw errUpsert;

    actualizados.push({ nombre: student.nombre, handle: student.codeforces_handle, ac: accepted, puntos: puntosFinales });
  }

  if (actualizados.length === 0) {
    return interaction.editReply(
      '⚠️ No se encontró ningún estudiante vinculado en el texto ingresado.\n' +
      'Verifica que los handles coincidan con los registrados con `/vincular`.'
    );
  }

  const lineas = actualizados.map(
    a => `• **${a.nombre}** (\`@${a.handle}\`) ➔ **${a.ac} AC** (\`${a.puntos.toFixed(1)} pts\`)`
  );

  return replyWithPages(interaction, lineas, (texto, pagina, totalPaginas) => new EmbedBuilder()
    .setTitle('⚡ Standings Importados Exitosamente')
    .setColor(0x00A86B)
    .setDescription(
      `**Sesión:** ${sesion.nombre} (ID: \`${sesion.id}\`)\n` +
      `**Factor:** \`${puntosPorProblema} pts por problema resuelto\`\n` +
      `**Resultados Procesados:** \`${actualizados.length}\`\n` +
      `**Página:** \`${pagina}/${totalPaginas}\`\n\n` +
      texto
    )
    .setFooter({ text: 'CPC Concurso Sync • Standings Parser' })
    .setTimestamp());
}

module.exports = {
  commands: {
    'sincronizar-codeforces': handleCodeforcesSyncCommand,
    'importar-standings': handleImportStandingsCommand
  },
  modals: [
    { matches: customId => customId.startsWith(STANDINGS_MODAL_PREFIX), handle: handleStandingsModal }
  ]
};
