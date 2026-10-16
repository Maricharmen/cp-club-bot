const { EmbedBuilder, MessageFlags } = require('discord.js');
const students = require('../services/students');
const sessions = require('../services/sessions');
const sessionRecords = require('../services/sessionRecords');
const { generarCodigoOTP } = require('../utils/otp');
const { normalizeEmail } = require('../utils/text');

const DEFAULT_CODE_MINUTES = 15;
const SUMMARY_LIST_LIMIT = 15;

function toDiscordTimestamp(date, style) {
  return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

// /iniciar-sesion
async function handleStartSessionCommand(interaction) {
  await interaction.deferReply();

  const sesionId = interaction.options.getInteger('sesion_id');
  const minutos = interaction.options.getInteger('minutos') || DEFAULT_CODE_MINUTES;

  const { data: sesion, error: errSesion } = await sessions.findSessionById(sesionId);

  if (errSesion || !sesion) {
    return interaction.editReply(`❌ No se encontró ninguna sesión con el ID \`${sesionId}\`.`);
  }

  const codigo = generarCodigoOTP(6);
  const fechaExpiracion = new Date(Date.now() + minutos * 60 * 1000);

  const { error: errUpdate } = await sessions.openAttendance(sesion.id, codigo, fechaExpiracion);

  if (errUpdate) {
    return interaction.editReply('❌ Error al actualizar el código de asistencia en Supabase.');
  }

  const embed = new EmbedBuilder()
    .setTitle(`📢 Asistencia Abierta: ${sesion.nombre}`)
    .setColor(0x3498DB)
    .setDescription(
      `Se ha habilitado el registro de asistencia para la sesión de hoy.\n\n` +
      `🔑 **Código de Registro:** \`${codigo}\`\n` +
      `⏳ **Válido durante:** \`${minutos} minutos\` (Expira ${toDiscordTimestamp(fechaExpiracion, 'R')})\n\n` +
      `Para registrar tu asistencia escribe en el chat:\n` +
      `**\`/asistencia codigo:${codigo}\`**`
    )
    .addFields(
      { name: '📚 Programa', value: `${sesion.programa}`, inline: true },
      { name: '🏷️ Módulo', value: `${sesion.modulo}`, inline: true },
      { name: '🆔 ID de Sesión', value: `\`${sesion.id}\``, inline: true }
    )
    .setFooter({ text: 'Attendance System' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// /asistencia
async function handleAttendanceCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const codigoIngresado = interaction.options.getString('codigo').trim().toUpperCase();

  const { data: estudiante, error: errEstudiante } = await students.findStudentByDiscordId(interaction.user.id);

  if (errEstudiante || !estudiante) {
    return interaction.editReply(
      '❌ Tu cuenta de Discord no está vinculada. Por favor ejecuta primero:\n' +
      '`/vincular correo:tu_correo@alumnos.uady.mx`'
    );
  }

  const { data: sesion, error: errSesion } = await sessions.findActiveSessionByCode(codigoIngresado);

  if (errSesion || !sesion) {
    return interaction.editReply('❌ Código de asistencia inválido o no pertenece a una sesión activa.');
  }

  const ahora = new Date();
  if (ahora > new Date(sesion.codigo_expira_en)) {
    return interaction.editReply('❌ El código de asistencia ha expirado.');
  }

  if (sesion.programa === 'CPC' && !estudiante.inscrito_cpc) {
    return interaction.editReply('⚠️ No estás registrado(a) en el track de CPC.');
  }
  if (sesion.programa === 'HUB' && !estudiante.inscrito_hub) {
    return interaction.editReply('⚠️ No estás registrado(a) en el track de HUB.');
  }

  const { data: registroExistente } = await sessionRecords.getRecord(sesion.id, estudiante.id, 'asistencia');

  if (registroExistente?.asistencia === 'PRESENTE') {
    return interaction.editReply('ℹ️ Ya habías registrado tu asistencia para esta sesión.');
  }

  const { error: errUpsert } = await sessionRecords.upsertRecord({
    sesion_id: sesion.id,
    estudiante_id: estudiante.id,
    asistencia: 'PRESENTE'
  });

  if (errUpsert) {
    return interaction.editReply('❌ Error al registrar tu asistencia en la base de datos.');
  }

  // El timestamp de Discord se muestra en la zona horaria de cada usuario,
  // no en la del servidor (UTC dentro de Docker).
  return interaction.editReply(
    `✅ **¡Asistencia registrada con éxito!**\n` +
    `• **Estudiante:** ${estudiante.nombre}\n` +
    `• **Sesión:** ${sesion.nombre} (${sesion.programa} - ${sesion.modulo})\n` +
    `• **Fecha/Hora:** ${toDiscordTimestamp(ahora, 'f')}`
  );
}

// /resumen-sesion
async function handleSessionSummaryCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const sesionId = interaction.options.getInteger('sesion_id');

  const { data: sesion, error: errSes } = await sessions.findSessionById(
    sesionId,
    'id, nombre, programa, modulo, activa, codigo_asistencia, codigo_expira_en'
  );

  if (errSes || !sesion) {
    return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
  }

  const { data: estudiantesEsperados, error: errEst } = await students.listActiveStudentsInProgram(
    sesion.programa,
    'id, nombre, correo'
  );
  if (errEst) {
    return interaction.editReply('❌ Error al consultar estudiantes del track.');
  }

  const { data: registros, error: errReg } = await sessionRecords.listSessionRecords(sesion.id);
  if (errReg) {
    return interaction.editReply('❌ Error al consultar registros de la sesión.');
  }

  const mapaRegistros = new Map(registros.map(r => [r.estudiante_id, r]));
  const presentes = [];
  const justificados = [];
  const ausentes = [];

  estudiantesEsperados.forEach(est => {
    const reg = mapaRegistros.get(est.id);
    if (!reg || reg.asistencia === 'AUSENTE') {
      ausentes.push(`• ${est.nombre}`);
    } else if (reg.asistencia === 'JUSTIFICADO') {
      justificados.push(`• ${est.nombre} *(Justificado)*`);
    } else {
      presentes.push(`• ${est.nombre}`);
    }
  });

  const totalEsperados = estudiantesEsperados.length;
  const totalAsistieron = presentes.length + justificados.length;
  const quorumPct = totalEsperados > 0 ? ((totalAsistieron / totalEsperados) * 100).toFixed(0) : '0';

  const listarConLimite = lista => {
    const visibles = lista.slice(0, SUMMARY_LIST_LIMIT).join('\n');
    const restantes = lista.length - SUMMARY_LIST_LIMIT;
    return restantes > 0 ? `${visibles}\n_...y ${restantes} más_` : visibles;
  };

  const embed = new EmbedBuilder()
    .setTitle(`📋 Resumen de Sesión: ${sesion.nombre}`)
    .setColor(sesion.activa ? 0x00A86B : 0x34495E)
    .setDescription(
      `**Programa:** ${sesion.programa} | **Módulo:** ${sesion.modulo}\n` +
      `**Estado:** ${sesion.activa ? '🟢 Sesión Abierta' : '⚪ Sesión Cerrada'}\n` +
      `**Quórum:** **${totalAsistieron}/${totalEsperados}** (\`${quorumPct}%\`)\n` +
      (sesion.codigo_asistencia ? `**Código OTP:** \`${sesion.codigo_asistencia}\`\n` : '')
    )
    .addFields(
      {
        name: `✅ Presentes (${presentes.length})`,
        value: presentes.length > 0 ? listarConLimite(presentes) : '_Nadie ha registrado asistencia_',
        inline: true
      },
      {
        name: `❌ Ausentes (${ausentes.length})`,
        value: ausentes.length > 0 ? listarConLimite(ausentes) : '_Todos presentes_',
        inline: true
      }
    )
    .setFooter({ text: 'Tracker • Monitoreo' })
    .setTimestamp();

  if (justificados.length > 0) {
    embed.addFields({
      name: `⚠️ Justificados (${justificados.length})`,
      value: listarConLimite(justificados),
      inline: false
    });
  }

  return interaction.editReply({ embeds: [embed] });
}

// /justificar-falta
async function handleExcuseAbsenceCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const correoInput = normalizeEmail(interaction.options.getString('correo'));
  const sesionId = interaction.options.getInteger('sesion_id');
  const motivo = interaction.options.getString('motivo').trim();

  const { data: estudiante, error: errEst } = await students.findStudentByEmail(correoInput, 'id, nombre, correo');

  if (errEst || !estudiante) {
    return interaction.editReply(`❌ No se encontró ningún estudiante con el correo \`${correoInput}\`.`);
  }

  const { data: sesion, error: errSes } = await sessions.findSessionById(sesionId, 'id, nombre, programa');

  if (errSes || !sesion) {
    return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
  }

  const { error: upsertError } = await sessionRecords.upsertRecord({
    sesion_id: sesion.id,
    estudiante_id: estudiante.id,
    asistencia: 'JUSTIFICADO',
    feedback: `Falta justificada: ${motivo}`
  });

  if (upsertError) {
    return interaction.editReply(`❌ Error al guardar justificación: ${upsertError.message}`);
  }

  return interaction.editReply(
    `✅ **Falta Justificada con Éxito**\n` +
    `• **Estudiante:** ${estudiante.nombre} (\`${estudiante.correo}\`)\n` +
    `• **Sesión:** ${sesion.nombre} (${sesion.programa})\n` +
    `• **Motivo:** "${motivo}"\n` +
    `*(Esta sesión ahora cuenta positivamente para su porcentaje de asistencia)*`
  );
}

module.exports = {
  commands: {
    'iniciar-sesion': handleStartSessionCommand,
    asistencia: handleAttendanceCommand,
    'resumen-sesion': handleSessionSummaryCommand,
    'justificar-falta': handleExcuseAbsenceCommand
  }
};
