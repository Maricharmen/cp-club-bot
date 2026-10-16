const { EmbedBuilder, MessageFlags } = require('discord.js');
const students = require('../services/students');
const sessionRecords = require('../services/sessionRecords');
const { getActiveCycle, getCycleSessions } = require('../services/cycles');
const { getRankProgress, generateProgressBar, getEarnedBadges } = require('../domain/ranks');
const { parseScore, sumXp } = require('../domain/xp');

const INDUSTRY_MOCK_MIN_ATTENDANCE = 80;
const ATTENDED_STATES = new Set(['PRESENTE', 'JUSTIFICADO']);

function attendanceForProgram(sesiones, mapaRegistros, programa) {
  const delPrograma = sesiones.filter(s => s.programa === programa);
  const asistidas = delPrograma.filter(s => ATTENDED_STATES.has(mapaRegistros.get(s.id)?.asistencia)).length;
  const porcentaje = delPrograma.length > 0 ? Math.round((asistidas / delPrograma.length) * 100) : null;
  return { total: delPrograma.length, asistidas, porcentaje };
}

function countCompleted(sesiones, mapaRegistros, tipo) {
  const delTipo = sesiones.filter(s => s.tipo === tipo);
  const completadas = delTipo.filter(s => parseScore(mapaRegistros.get(s.id)?.puntaje_actividad) > 0).length;
  return { total: delTipo.length, completadas };
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
    'id, nombre, programa, modulo, fecha, tipo, ciclo_id'
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

  // Elegibilidad para Industry Mock: asistencia >= 80% en algún track.
  const cpc = attendanceForProgram(sesiones, mapaRegistros, 'CPC');
  const hub = attendanceForProgram(sesiones, mapaRegistros, 'HUB');
  const elegible = [cpc, hub].some(track => track.porcentaje !== null && track.porcentaje >= INDUSTRY_MOCK_MIN_ATTENDANCE);
  const formatPct = track => (track.porcentaje === null ? 'N/A' : `${track.porcentaje}%`);

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
      `**Elegibilidad Industry Mock (Req: ${INDUSTRY_MOCK_MIN_ATTENDANCE}%):** ${elegible ? '✅ **ELEGIBLE**' : '⏳ **EN PROGRESO**'}\n\n` +
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
      {
        name: '💻 Track CPC',
        value: `Asistencia: **${cpc.asistidas}/${cpc.total}** (\`${formatPct(cpc)}\`)`,
        inline: true
      },
      {
        name: '💼 Track HUB',
        value: `Asistencia: **${hub.asistidas}/${hub.total}** (\`${formatPct(hub)}\`)`,
        inline: true
      }
    )
    .setFooter({ text: 'CPC Ranking System' })
    .setTimestamp();

  if (feedbacksRecientes.length > 0) {
    embed.addFields({
      name: '💬 Último Feedback Recibido',
      value: feedbacksRecientes.slice(-2).map(f => `• ${f}`).join('\n').slice(0, 1024),
      inline: false
    });
  }

  if (badgesGanados.length > 0) {
    embed.addFields({
      name: '🏅 Badges de culminación',
      value: badgesGanados.map(badge => `${badge.badge} **${badge.name}**: ${badge.desc}`).join('\n'),
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
