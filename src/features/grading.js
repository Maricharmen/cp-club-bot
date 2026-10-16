const { EmbedBuilder, MessageFlags } = require('discord.js');
const students = require('../services/students');
const sessions = require('../services/sessions');
const sessionRecords = require('../services/sessionRecords');
const { getActiveCycle } = require('../services/cycles');
const { checkLevelUp } = require('../domain/ranks');
const { normalizeEmail } = require('../utils/text');

// Flujo común de /calificar-mock y /calificar-concurso. Devuelve null si ya
// respondió al usuario con un error de validación.
async function registerGrade(interaction, buildFeedback) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const correoInput = normalizeEmail(interaction.options.getString('correo'));
  const sesionId = interaction.options.getInteger('sesion_id');
  const puntaje = interaction.options.getNumber('puntaje');

  const { data: estudiante, error: errEst } = await students.findStudentByEmail(correoInput, 'id, nombre, correo');
  if (errEst || !estudiante) {
    await interaction.editReply(`❌ No se encontró ningún estudiante con el correo \`${correoInput}\`.`);
    return null;
  }

  const { data: sesion, error: errSes } = await sessions.findSessionById(sesionId, 'id, nombre, programa');
  if (errSes || !sesion) {
    await interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
    return null;
  }

  // El XP se mide en el ciclo activo, igual que en /mi-progreso y /leaderboard.
  const { data: cicloActivo, error: errCiclo } = await getActiveCycle();
  if (errCiclo) throw errCiclo;

  const xpPrevio = cicloActivo ? await sessionRecords.getStudentCycleXp(estudiante.id, cicloActivo.id) : null;

  const { error: upsertError } = await sessionRecords.saveScore({
    sessionId: sesion.id,
    studentId: estudiante.id,
    score: puntaje,
    feedback: buildFeedback(puntaje)
  });

  if (upsertError) {
    await interaction.editReply(`❌ Error al guardar la calificación: ${upsertError.message}`);
    return null;
  }

  const xpNuevo = cicloActivo ? await sessionRecords.getStudentCycleXp(estudiante.id, cicloActivo.id) : null;
  const nuevoRango = cicloActivo ? checkLevelUp(xpPrevio, xpNuevo) : null;

  return { estudiante, sesion, puntaje, xpNuevo, nuevoRango };
}

function formatXp(xp) {
  return xp === null ? 'Sin ciclo activo' : `${xp.toFixed(1)} XP`;
}

const LEVEL_UP_TITLE = '🎉 ¡NUEVO RANGO ALCANZADO!';

function levelUpDetail(rank, nombre, xp) {
  return `${rank.badge} **${nombre}** ascendió al rango **${rank.name.toUpperCase()}** (${formatXp(xp)})`;
}

// /calificar-mock
async function handleGradeMockCommand(interaction) {
  const feedback = interaction.options.getString('feedback').trim();
  const resultado = await registerGrade(interaction, () => `Mock Interview: ${feedback}`);
  if (!resultado) return;

  const { estudiante, sesion, puntaje, xpNuevo, nuevoRango } = resultado;

  const embed = new EmbedBuilder()
    .setTitle('✅ Mock Interview Calificada')
    .setColor(0x00A86B)
    .setDescription('Se ha registrado la retroalimentación de la entrevista con éxito.')
    .addFields(
      { name: '👤 Estudiante', value: `${estudiante.nombre} (\`${estudiante.correo}\`)`, inline: false },
      { name: '🎯 Sesión', value: `${sesion.nombre}`, inline: true },
      { name: '⭐ Puntaje', value: `\`${puntaje.toFixed(1)} / 100\``, inline: true },
      { name: '📈 XP Total', value: `\`${formatXp(xpNuevo)}\``, inline: true },
      { name: '📝 Feedback', value: feedback.slice(0, 1024), inline: false }
    )
    .setFooter({ text: 'HUB Mock Interview Tracker' })
    .setTimestamp();

  if (nuevoRango) {
    embed.addFields({
      name: LEVEL_UP_TITLE,
      value: levelUpDetail(nuevoRango, estudiante.nombre, xpNuevo),
      inline: false
    });
  }

  return interaction.editReply({ embeds: [embed] });
}

// /calificar-concurso
async function handleGradeContestCommand(interaction) {
  const feedback = interaction.options.getString('feedback')?.trim() || null;
  const resultado = await registerGrade(
    interaction,
    puntaje => feedback || `Concurso: ${puntaje} pts registrados manualmente`
  );
  if (!resultado) return;

  const { estudiante, sesion, puntaje, xpNuevo, nuevoRango } = resultado;

  let respuesta =
    `✅ **Puntaje de Concurso Registrado**\n` +
    `• **Estudiante:** ${estudiante.nombre} (\`${estudiante.correo}\`)\n` +
    `• **Sesión:** ${sesion.nombre}\n` +
    `• **Puntaje de sesión:** \`${puntaje.toFixed(1)} pts\`\n` +
    `• **XP Total:** \`${formatXp(xpNuevo)}\`\n` +
    (feedback ? `• **Feedback:** ${feedback}\n` : '');

  if (nuevoRango) {
    respuesta += `\n**${LEVEL_UP_TITLE}**\n${levelUpDetail(nuevoRango, estudiante.nombre, xpNuevo)}`;
  }

  return interaction.editReply(respuesta);
}

module.exports = {
  commands: {
    'calificar-mock': handleGradeMockCommand,
    'calificar-concurso': handleGradeContestCommand
  }
};
