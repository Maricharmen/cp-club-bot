// index.js — punto de entrada: valida la configuración, registra las features y conecta el bot.
const config = require('./src/config');

config.validateConfig();

const { Events } = require('discord.js');
const { createDiscordClient } = require('./src/client');
const { registerInteractionRouter } = require('./src/interactions/router');
const dynamicVoiceChannels = require('./src/features/dynamicVoiceChannels');
const teams = require('./src/features/teams');
const birthdays = require('./src/features/birthdays');

const client = createDiscordClient();

dynamicVoiceChannels.setupDynamicVoiceChannels(client);
teams.setupTeams(client);
birthdays.setupBirthdays(client);
registerInteractionRouter(client);

client.once(Events.ClientReady, readyClient => {
  console.log(`🤖 CP Club Bot conectado exitosamente como: ${readyClient.user.tag}`);
});

client.on(Events.Error, error => {
  console.error('Error del cliente de Discord:', error);
});

process.on('unhandledRejection', error => {
  console.error('Promesa rechazada sin manejar:', error);
});

// `docker compose stop/up` envía SIGTERM: cerramos la conexión de forma ordenada.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    console.log(`Recibido ${signal}, desconectando el bot...`);
    client.destroy().finally(() => process.exit(0));
  });
}

client.login(config.discordToken);
