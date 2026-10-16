const { EmbedBuilder, MessageFlags } = require('discord.js');
const students = require('../services/students');
const sessionRecords = require('../services/sessionRecords');
const { getActiveCycle, getCycleSessions } = require('../services/cycles');
const { getRankProgress, generateProgressBar, getEarnedBadges } = require('../domain/ranks');
const { parseScore, sumXp } = require('../domain/xp');
const { todayInTimeZone, splitSessionsByDate } = require('../domain/sessionSchedule');
const { renderSessionTables, formatUpcomingLine, MAX_FIELD_LENGTH } = require('../utils/sessionTable');
const config = require('../config');

const INDUSTRY_MOCK_MIN_ATTENDANCE = 80;
const ATTENDED_STATES = new Set(['PRESENTE', 'JUSTIFICADO']);
const TRACKS = [
  { programa: 'CPC', emoji: '💻', enrolledKey: 'inscrito_cpc' },
  { programa: 'HUB', emoji: '💼', enrolledKey: 'inscrito_hub' }
];

function attendanceForSessions(sesiones, mapaRegistros) {
  const asistidas = sesiones.filter(s => ATTENDED_STATES.has(mapaRegistros.get(s.id)?.asistencia)).length;
  const porcentaje = sesiones.length > 0 ? Math.round((asistidas / sesiones.length) * 100) : null;
  return { total: sesiones.length, asistidas, porcentaje };
}

function countCompleted(sesiones, mapaRegistros, tipo) {
  const delTipo = sesiones.filter(s => s.tipo === tipo);
  const completadas = delTipo.filter(s => parseScore(mapaRegistros.get(s.id)?.puntaje_actividad) > 0).length;
  return { total: delTipo.length, completadas };
}

// Asistencia e historial de cada track en el que el estudiante está inscrito.
// La asistencia solo considera sesiones ya realizadas: una sesión futura no es falta.
function buildTrackSummaries(estudiante, sesiones, mapaRegistros, today) {
  return TRACKS
    .filter(track => estudiante[track.enrolledKey])
    .map(track => {
      const { held, upcoming } = splitSessionsByDate(
        sesiones.filter(s => s.programa === track.programa),
        mapaRegistros,
        today
      );
      return {
        ...track,
        realizadas: held,
        proximas: upcoming,
        asistencia: attendanceForSessions(held, mapaRegistros)
      };
    });
}

function trackHistoryFields(track, mapaRegistros) {
  const nombre = `📅 Historial ${track.programa}`;
  const tablas = renderSessionTables(track.realizadas, mapaRegistros);
  const proxima = formatUpcomingLine(track.proximas);

  if (tablas.length === 0) {
    const vacio = '_Aún no hay sesiones realizadas en este ciclo._';
    return [{ name: nombre, value: proxima ? `${vacio}\n${proxima}` : vacio, inline: false }];
  }

  const campos = tablas.map((tabla, index) => ({
    name: index === 0 ? nombre : `${nombre} (cont.)`,
    value: tabla,
    inline: false
  }));

  if (proxima) {
    const ultimo = campos[campos.length - 1];
    if (ultimo.value.length + proxima.length + 1 <= MAX_FIELD_LENGTH) {
      ultimo.value += `\n${proxima}`;
    } else {
      campos.push({ name: `🕒 Próximas sesiones ${track.programa}`, value: proxima, inline: false });
    }
  }

  return campos;
}

function eligibilityText(tracks) {
  if (tracks.length === 0) return '⚪ **SIN TRACK INSCRITO**';
  const elegible = tracks.some(track =>
    track.asistencia.porcentaje !== null && track.asistencia.porcentaje >= INDUSTRY_MOCK_MIN_ATTENDANCE);
  return elegible ? '✅ **ELEGIBLE**' : '⏳ **EN PROGRESO**';
}

function trackFields(tracks, mapaRegistros) {
  const resumenes = tracks.map(track => {
    const { asistidas, total, porcentaje } = track.asistencia;
    return {
      name: `${track.emoji} Track ${track.programa}`,
      value: `Asistencia: **${asistidas}/${total}** (\`${porcentaje === null ? 'N/A' : `${porcentaje}%`}\`)`,
      inline: true
    };
  });

  const historiales = tracks.flatMap(track => trackHistoryFields(track, mapaRegistros));

  return [...resumenes, ...historiales];
}

// /mi-progreso
async function handleProgressCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { data: estudiante, error: errEst } = await students.findStudentByDiscordId(interaction.user.id);

  if (errEst || !estudiante) {
    return interaction.editReply(
      '❌ Tu cuenta no está vinculada. Usa `/vincular correo:tu_correo@alumnos.uady.mx` para comenzar.'
    );
  }

  const { data: cicloActivo, error: errCiclo } = await getActiveCycle();
  if (errCiclo || !cicloActivo) {
    return interaction.editReply('❌ No hay un ciclo académico activo configurado.');
  }

  const { data: sesiones, error: errSes } = await getCycleSessions(
    cicloActivo.id,
    'id, nombre, programa, modulo, fecha, tipo'
  );
  if (errSes) {
    return interaction.editReply('❌ Error al consultar tus estadísticas.');
  }

  const { data: registros, error: errReg } = await sessionRecords.listStudentRecords(
    estudiante.id,
    sesiones.map(sesion => sesion.id)
  );
  if (errReg) {
    return interaction.editReply('❌ Error al consultar tus estadísticas.');
  }

  const mapaRegistros = new Map(registros.map(r => [r.sesion_id, r]));
  const puntajeTotal = sumXp(registros);
  const feedbacksRecientes = registros.filter(r => r.feedback).map(r => r.feedback);

  const { currentRank, nextRank, percentage, remainingXP } = getRankProgress(puntajeTotal);
  const progressBar = generateProgressBar(percentage, 10);

  const practicas = countCompleted(sesiones, mapaRegistros, 'PRACTICA');
  const integradores = countCompleted(sesiones, mapaRegistros, 'INTEGRADOR');
  const mocks = countCompleted(sesiones, mapaRegistros, 'MOCK');

  const badgesGanados = getEarnedBadges({
    practicas: practicas.completadas,
    totalPracticas: practicas.total,
    integradores: integradores.completadas,
    totalIntegradores: integradores.total,
    mocks: mocks.completadas,
    totalMocks: mocks.total
  });

  // Elegibilidad para Industry Mock: asistencia >= 80% en algún track inscrito.
  // Las actividades y badges sí cuentan el ciclo completo (incluye sesiones futuras).
  const tracks = buildTrackSummaries(estudiante, sesiones, mapaRegistros, todayInTimeZone(config.timeZone));

  const proximoRangoTexto = nextRank
    ? `**Próximo rango:** ${nextRank.badge}${nextRank.name}\n` +
      `\`${remainingXP} XP restantes\`\n` +
      `\`${progressBar}\``
    : '👑 **Nivel Máximo Alcanzado**';

  const embed = new EmbedBuilder()
    .setTitle(`👤 Progreso Académico • ${estudiante.nombre}`)
    .setColor(currentRank.color)
    .setDescription(
      `**Correo:** \`${estudiante.correo}\`\n` +
      `**Codeforces:** \`${estudiante.codeforces_handle || 'No vinculado'}\`\n` +
      `**Rango actual:** ${currentRank.badge} **${currentRank.name}**\n` +
      `**XP Total Acumulada:** \`${puntajeTotal.toFixed(1)} XP\`\n\n` +
      `**Elegibilidad Industry Mock (Req: ${INDUSTRY_MOCK_MIN_ATTENDANCE}%):** ${eligibilityText(tracks)}\n\n` +
      proximoRangoTexto
    )
    .addFields(
      {
        name: '📚 Actividades completadas',
        value: `Prácticas: **${practicas.completadas}/${practicas.total}**\n` +
          `Integradores: **${integradores.completadas}/${integradores.total}**\n` +
          `Mock Interviews: **${mocks.completadas}/${mocks.total}**`,
        inline: false
      },
      ...trackFields(tracks, mapaRegistros)
    )
    .setFooter({ text: 'CPC Ranking System' })
    .setTimestamp();

  embed.addFields({
    name: '🎖️ Badges de Culminación',
    value: badgesGanados.length > 0
      ? badgesGanados.map(badge => `${badge.badge} **${badge.name}**: ${badge.desc}`).join('\n')
      : '_Aún no has completado ninguna categoría de actividades._',
    inline: false
  });

  if (feedbacksRecientes.length > 0) {
    embed.addFields({
      name: '💬 Último Feedback Recibido',
      value: feedbacksRecientes.slice(-2).map(f => `• ${f}`).join('\n').slice(0, 1024),
      inline: false
    });
  }

  return interaction.editReply({ embeds: [embed] });
}

module.exports = {
  commands: {
    'mi-progreso': handleProgressCommand
  }
};
