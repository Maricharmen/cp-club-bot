const { MessageFlags } = require('discord.js');
const { chunkLines } = require('./text');

const MAX_PAGE_LINES = 12;
// Margen bajo el límite de 4096 para el encabezado que agrega cada embed.
const MAX_PAGE_CHARS = 3500;

// Envía una lista larga como varios embeds efímeros: la primera página edita la
// respuesta diferida y las siguientes se envían como follow-ups.
async function replyWithPages(interaction, lines, buildEmbed) {
  const pages = chunkLines(lines, { maxLines: MAX_PAGE_LINES, maxChars: MAX_PAGE_CHARS });

  await interaction.editReply({ embeds: [buildEmbed(pages[0].join('\n'), 1, pages.length)] });

  for (let i = 1; i < pages.length; i++) {
    await interaction.followUp({
      embeds: [buildEmbed(pages[i].join('\n'), i + 1, pages.length)],
      flags: MessageFlags.Ephemeral
    });
  }
}

// Responde con un error sin importar en qué estado quedó la interacción.
async function replyWithError(interaction, content) {
  if (!interaction.isRepliable()) return;

  try {
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content, embeds: [], components: [] });
    } else if (interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error('No se pudo notificar el error al usuario:', error);
  }
}

module.exports = { replyWithPages, replyWithError };
