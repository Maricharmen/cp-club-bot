require('./src/config');
const { REST, Routes } = require('discord.js');
const commands = require('./src/commands');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`[Deploy] Registrando ${commands.length} Slash Commands...`);
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash Commands actualizados exitosamente en Discord.');
  } catch (error) {
    console.error('Error al desplegar comandos:', error);
  }
})();
