const { Events } = require('discord.js');
const { commandHandlers, componentRoutes } = require('./registry');
const { replyWithError } = require('../utils/interactions');

const GENERIC_ERROR_MESSAGE = '❌ Ocurrió un error inesperado. Intenta de nuevo o contacta a un mentor.';

function findHandler(interaction) {
  if (interaction.isChatInputCommand()) return commandHandlers[interaction.commandName];
  return componentRoutes.find(route => route.matches(interaction))?.handle;
}

function describeInteraction(interaction) {
  return interaction.isChatInputCommand() ? `/${interaction.commandName}` : interaction.customId;
}

// Punto único de manejo de errores: ningún fallo de un handler tumba el
// proceso y el usuario siempre recibe una respuesta.
function registerInteractionRouter(client) {
  client.on(Events.InteractionCreate, async interaction => {
    const handler = findHandler(interaction);
    if (!handler) return;

    try {
      await handler(interaction);
    } catch (error) {
      console.error(`Error procesando ${describeInteraction(interaction)}:`, error);
      await replyWithError(interaction, GENERIC_ERROR_MESSAGE);
    }
  });
}

module.exports = { registerInteractionRouter };
