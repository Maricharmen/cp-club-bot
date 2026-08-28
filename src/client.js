const { Client, GatewayIntentBits } = require('discord.js');

function createDiscordClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates
    ]
  });
}

module.exports = { createDiscordClient };
