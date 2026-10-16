const path = require('node:path');
const { EmbedBuilder, Events, MessageFlags } = require('discord.js');
const config = require('../config');
const { createJsonStore } = require('../storage/jsonStore');

const TIME_ZONE = config.birthdayTimeZone;
const CHECK_INTERVAL_MS = 60_000;
const birthdayStore = createJsonStore(path.join(config.dataDirectory, 'birthdays.json'), {
  createDefault: () => ({ channels: [], birthdays: [], notifications: { monthly: {}, daily: {} } }),
  normalize: store => {
    store.channels ||= [];
    store.birthdays ||= [];
    store.notifications ||= { monthly: {}, daily: {} };
    store.notifications.monthly ||= {};
    store.notifications.daily ||= {};
    return store;
  }
});
const { read: readStore, write: writeStore, update: updateStore } = birthdayStore;
let discordClient;

function getDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  return Object.fromEntries(parts
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)]));
}

function formatBirthday(month, day) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: TIME_ZONE,
    month: 'long',
    day: 'numeric'
  }).format(new Date(Date.UTC(2000, month - 1, day, 12)));
}

function formatMonth(month) {
  return new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    timeZone: TIME_ZONE
  }).format(new Date(Date.UTC(2000, month - 1, 1, 12)));
}

function isValidBirthday(month, day) {
  return Number.isInteger(month) && Number.isInteger(day) &&
    month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(2000, month, 0)).getUTCDate();
}

function getMonthBirthdays(store, guildId, month) {
  return store.birthdays
    .filter(birthday => birthday.guildId === guildId && birthday.month === month)
    .sort((a, b) => a.day - b.day);
}

function birthdayLines(birthdays) {
  return birthdays.map(birthday => `• <@${birthday.userId}> - ${formatBirthday(birthday.month, birthday.day)}`);
}

async function getConfiguredChannel(guild, channelId) {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() ? channel : null;
}

async function sendMonthlyReminder(channel, birthdays, month) {
  const userIds = birthdays.map(birthday => birthday.userId);
  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle(`🎂 Cumpleaños de ${formatMonth(month)}`)
      .setColor(0xF1C40F)
      .setDescription(`Estos son los cumpleaños registrados para este mes:\n\n${birthdayLines(birthdays).join('\n')}`)
      .setFooter({ text: 'Recordatorio mensual de cumpleaños' })
      .setTimestamp()],
    allowedMentions: { users: userIds }
  });
}

async function sendDailyReminder(channel, birthdays) {
  const userIds = birthdays.map(birthday => birthday.userId);
  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle('🎉 ¡Hoy hay cumpleaños!')
      .setColor(0x57F287)
      .setDescription(`Hoy celebramos a:\n\n${birthdayLines(birthdays).join('\n')}`)
      .setFooter({ text: 'Recordatorio diario de cumpleaños' })
      .setTimestamp()],
    allowedMentions: { users: userIds }
  });
}

async function processBirthdays() {
  if (!discordClient?.isReady()) return;

  const store = readStore();
  const now = getDateParts();
  const monthKey = `${now.year}-${String(now.month).padStart(2, '0')}`;
  const dayKey = `${monthKey}-${String(now.day).padStart(2, '0')}`;
  const changes = await Promise.all(store.channels.map(configuredChannel =>
    processGuildBirthdays(configuredChannel, store, now.month, now.day, monthKey, dayKey)));

  if (changes.some(Boolean)) writeStore(store);
}

async function processGuildBirthdays(configuredChannel, store, month, day, monthKey, dayKey) {
  const guild = discordClient.guilds.cache.get(configuredChannel.guildId);
  if (!guild) return false;

  const channel = await getConfiguredChannel(guild, configuredChannel.channelId);
  if (!channel) return false;

  const monthBirthdays = getMonthBirthdays(store, guild.id, month);
  let changed = false;

  if (monthBirthdays.length > 0 && store.notifications.monthly[guild.id] !== monthKey) {
    try {
      await sendMonthlyReminder(channel, monthBirthdays, month);
      store.notifications.monthly[guild.id] = monthKey;
      changed = true;
    } catch (error) {
      console.error(`Error enviando resumen mensual de cumpleaños en ${guild.name}:`, error);
    }
  }

  const todayBirthdays = monthBirthdays.filter(birthday => birthday.day === day);
  if (todayBirthdays.length > 0 && store.notifications.daily[guild.id] !== dayKey) {
    try {
      await sendDailyReminder(channel, todayBirthdays);
      store.notifications.daily[guild.id] = dayKey;
      changed = true;
    } catch (error) {
      console.error(`Error enviando recordatorio diario de cumpleaños en ${guild.name}:`, error);
    }
  }

  return changed;
}

async function handleBirthdayCommand(interaction) {
  const month = interaction.options.getInteger('mes');
  const day = interaction.options.getInteger('dia');
  if (!isValidBirthday(month, day)) {
    return interaction.reply({ content: '❌ Esa fecha no es válida. Revisa el mes y el día.', flags: MessageFlags.Ephemeral });
  }

  updateStore(store => {
    store.birthdays = store.birthdays.filter(birthday => !(birthday.guildId === interaction.guild.id && birthday.userId === interaction.user.id));
    store.birthdays.push({ guildId: interaction.guild.id, userId: interaction.user.id, month, day });
  });

  return interaction.reply({
    content: `✅ Tu cumpleaños quedó registrado para el **${formatBirthday(month, day)}**. Puedes actualizarlo ejecutando este comando nuevamente.`,
    flags: MessageFlags.Ephemeral
  });
}

async function handleConfigureChannelCommand(interaction) {
  const channel = interaction.options.getChannel('canal');
  if (!channel?.isTextBased()) {
    return interaction.reply({ content: '❌ Selecciona un canal de texto válido.', flags: MessageFlags.Ephemeral });
  }

  updateStore(store => {
    store.channels = store.channels.filter(configuredChannel => configuredChannel.guildId !== interaction.guild.id);
    store.channels.push({ guildId: interaction.guild.id, channelId: channel.id });
  });

  return interaction.reply({ content: `✅ Los recordatorios de cumpleaños se enviarán en ${channel}.`, flags: MessageFlags.Ephemeral });
}

async function handleListCommand(interaction) {
  const month = interaction.options.getInteger('mes');
  const birthdays = getMonthBirthdays(readStore(), interaction.guild.id, month);
  const monthName = formatMonth(month);

  return interaction.reply({
    content: birthdays.length > 0
      ? `🎂 **Cumpleaños de ${monthName}:**\n${birthdayLines(birthdays).join('\n')}`
      : `ℹ️ No hay cumpleaños registrados para ${monthName}.`,
    flags: MessageFlags.Ephemeral
  });
}

async function handleCommand(interaction) {
  if (interaction.commandName === 'cumpleanos') return handleBirthdayCommand(interaction);
  if (interaction.commandName === 'configurar-canal-cumpleanos') return handleConfigureChannelCommand(interaction);
  if (interaction.commandName === 'listar-cumpleanos') return handleListCommand(interaction);
  return null;
}

function setupBirthdays(client) {
  discordClient = client;
  client.once(Events.ClientReady, () => processBirthdays().catch(error => {
    console.error('Error procesando recordatorios iniciales de cumpleaños:', error);
  }));
  setInterval(() => processBirthdays().catch(error => {
    console.error('Error procesando recordatorios de cumpleaños:', error);
  }), CHECK_INTERVAL_MS).unref();
}

module.exports = { handleCommand, setupBirthdays };
