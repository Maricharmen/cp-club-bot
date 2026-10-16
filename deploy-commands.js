const config = require('./src/config');
const { REST, Routes } = require('discord.js');
const commands = require('./src/commands');

(async () => {
  try {
    config.validateConfig();
    const rest = new REST({ version: '10' }).setToken(config.discordToken);

    console.log(`[Deploy] Registrando ${commands.length} Slash Commands...`);
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log('Slash Commands actualizados exitosamente en Discord.');
  } catch (error) {
    console.error('Error al desplegar comandos:', error);
    process.exitCode = 1;
  }
})();
