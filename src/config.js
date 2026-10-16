const path = require('node:path');

require('dotenv').config({ quiet: true });

const REQUIRED_ENV = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'SUPABASE_URL', 'SUPABASE_KEY'];

const config = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  birthdayTimeZone: process.env.BIRTHDAY_TIMEZONE || 'America/Merida',
  // Zona horaria para decidir qué sesiones ya ocurrieron.
  timeZone: process.env.TIMEZONE || process.env.BIRTHDAY_TIMEZONE || 'America/Merida',
  dataDirectory: path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'))
};

// Falla rápido con un mensaje claro en lugar de errores crípticos de Discord o Supabase.
function validateConfig() {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas: ${missing.join(', ')}. ` +
      'Revisa tu archivo .env (usa .env.example como guía).'
    );
  }
}

module.exports = { ...config, validateConfig };
