const { EmbedBuilder, MessageFlags } = require('discord.js');
const students = require('../services/students');
const { normalizeEmail } = require('../utils/text');

// /vincular
async function handleLinkCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const correoInput = normalizeEmail(interaction.options.getString('correo'));
  const codeforcesInput = interaction.options.getString('codeforces')?.trim() || null;
  const discordId = interaction.user.id;

  const { data: estudiante, error: errorBusqueda } = await students.findStudentByEmail(correoInput);

  if (errorBusqueda || !estudiante) {
    return interaction.editReply(
      `❌ No se encontró ningún registro para el correo \`${correoInput}\`.\nVerifica que esté escrito correctamente o contacta a un mentor.`
    );
  }

  // Evita que alguien que conoce el correo de otro estudiante tome su registro.
  if (estudiante.discord_user_id && estudiante.discord_user_id !== discordId) {
    return interaction.editReply(
      '❌ Este correo ya está vinculado a otra cuenta de Discord. Si crees que es un error, contacta a un mentor.'
    );
  }

  const { linked: tieneOtroVinculo, error: errorOtro } = await students.isDiscordLinkedToOtherStudent(discordId, estudiante.id);
  if (errorOtro) throw errorOtro;

  if (tieneOtroVinculo) {
    return interaction.editReply(
      '❌ Tu cuenta de Discord ya está vinculada a otro registro. Contacta a un mentor si necesitas cambiarla.'
    );
  }

  const updateData = { discord_user_id: discordId };
  if (codeforcesInput) updateData.codeforces_handle = codeforcesInput;

  const { error: errorUpdate } = await students.updateStudent(estudiante.id, updateData);

  if (errorUpdate) {
    console.error('Detalle error vinculación:', errorUpdate);
    return interaction.editReply(`❌ Error al actualizar en Supabase: \`${errorUpdate.message}\``);
  }

  const tracks = [];
  if (estudiante.inscrito_cpc) tracks.push('💻 CPC');
  if (estudiante.inscrito_hub) tracks.push('💼 HUB');

  const handleMostrado = codeforcesInput || estudiante.codeforces_handle;

  const embed = new EmbedBuilder()
    .setTitle('✅ Cuenta Vinculada Exitosamente')
    .setColor(0x00A86B)
    .setDescription(`¡Bienvenido(a), **${estudiante.nombre}**! Tu cuenta de Discord ha sido enlazada.`)
    .addFields(
      { name: '📧 Correo Institucional', value: `\`${estudiante.correo}\``, inline: true },
      { name: '🎯 Tracks Activos', value: tracks.join('\n') || '_Sin tracks asignados_', inline: true },
      { name: '🌐 Codeforces Handle', value: handleMostrado ? `\`${handleMostrado}\`` : '_No especificado_', inline: false }
    )
    .setFooter({ text: 'Tracker' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

module.exports = {
  commands: {
    vincular: handleLinkCommand
  }
};
