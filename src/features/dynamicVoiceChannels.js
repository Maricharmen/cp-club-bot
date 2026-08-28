const fs = require('node:fs');
const path = require('node:path');
const { ChannelType, EmbedBuilder, PermissionFlagsBits, Routes } = require('discord.js');

const DATA_DIRECTORY = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIRECTORY, 'voice-channels.json');
let discordClient;
function readStore() {
  try {
    const store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    store.hubs ||= [];
    store.dynamicChannels ||= [];
    store.logChannels ||= [];
    return store;
  } catch (error) {
    if (error.code === 'ENOENT') return { hubs: [], dynamicChannels: [], logChannels: [] };
    throw error;
  }
}

function writeStore(store) {
  fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(store, null, 2)}\n`);
}

function updateStore(update) {
  const store = readStore();
  update(store);
  writeStore(store);
  return store;
}

function isVoiceChannel(channel) {
  return channel?.type === ChannelType.GuildVoice;
}

function isCategory(channel) {
  return channel?.type === ChannelType.GuildCategory;
}

function getHubIds(guildId) {
  return readStore().hubs
    .filter(hub => hub.guildId === guildId)
    .map(hub => hub.channelId);
}

function getLogChannelId(guildId) {
  return readStore().logChannels.find(log => log.guildId === guildId)?.channelId;
}

function isTrackedVoiceChannel(channel) {
  const store = readStore();
  return isVoiceChannel(channel) && (
    store.hubs.some(hub => hub.guildId === channel.guild.id && hub.channelId === channel.id) ||
    store.dynamicChannels.includes(channel.id)
  );
}

async function sendVoiceLog(guildId, title, description, color = 0x5865F2) {
  const channelId = getLogChannelId(guildId);
  if (!channelId) return;

  const channel = await discordClient.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  await channel.send({
    embeds: [new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()]
  }).catch(error => {
    console.error('Error enviando log de voz:', error);
  });
}

async function sendVoiceGuide(channel, member) {
  await discordClient.rest.post(Routes.channelMessages(channel.id), {
    body: {
      content: [
        `👋 ${member}, este es tu canal de voz personal.`,
        '',
        '**Comandos disponibles:**',
        '`/configurar-mi-canal-voz nombre:Mi sala` para cambiar el nombre.',
        '`/configurar-mi-canal-voz limite:5` para limitarlo a 5 personas.',
        '`/configurar-mi-canal-voz nombre:Mi sala limite:5` para cambiar ambos.',
        '',
        'También puedes modificar sus propiedades desde las opciones del canal. El canal se eliminará automáticamente cuando quede vacío.'
      ].join('\n')
    }
  }).catch(error => {
    console.error('Error enviando guía al canal de voz:', error);
  });
}

function getVoiceChannelChanges(oldChannel, newChannel) {
  const changes = [];
  const addChange = (label, oldValue, newValue) => {
    if (oldValue !== newValue) changes.push(`**${label}:** \`${oldValue ?? 'ninguno'}\` → \`${newValue ?? 'ninguno'}\``);
  };

  addChange('Nombre', oldChannel.name, newChannel.name);
  addChange('Categoría', oldChannel.parentId, newChannel.parentId);
  addChange('Límite de usuarios', oldChannel.userLimit, newChannel.userLimit);
  addChange('Bitrate', oldChannel.bitrate, newChannel.bitrate);
  addChange('Región', oldChannel.rtcRegion, newChannel.rtcRegion);

  const oldPermissions = oldChannel.permissionOverwrites.cache.map(overwrite => `${overwrite.id}:${overwrite.allow.bitfield}:${overwrite.deny.bitfield}`).join('|');
  const newPermissions = newChannel.permissionOverwrites.cache.map(overwrite => `${overwrite.id}:${overwrite.allow.bitfield}:${overwrite.deny.bitfield}`).join('|');
  if (oldPermissions !== newPermissions) changes.push('**Permisos:** se actualizaron los permisos del canal');

  return changes;
}

async function handleChannelUpdate(oldChannel, newChannel) {
  if (!isTrackedVoiceChannel(newChannel)) return;

  const changes = getVoiceChannelChanges(oldChannel, newChannel);
  if (changes.length === 0) return;

  await sendVoiceLog(
    newChannel.guild.id,
    'Canal de voz modificado',
    `**Canal:** <#${newChannel.id}>\n${changes.join('\n')}\n\n*El evento de Discord no identifica automáticamente al autor del cambio.*`,
    0xFEE75C
  );
}

async function cleanStoredChannels(client) {
  const store = readStore();
  const remainingHubs = [];
  const remainingDynamicChannels = [];

  for (const hub of store.hubs) {
    const channel = await client.channels.fetch(hub.channelId).catch(() => null);
    if (isVoiceChannel(channel)) remainingHubs.push(hub);
  }

  for (const channelId of store.dynamicChannels) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!isVoiceChannel(channel)) continue;

    if (channel.members.size === 0) {
      await sendVoiceLog(
        channel.guild.id,
        'Canal dinámico cerrado',
        `**${channel.name}** estaba vacío al reiniciar el bot y fue eliminado.`,
        0xED4245
      );
      await channel.delete('Canal de voz dinámico vacío tras reinicio').catch(() => null);
    } else {
      remainingDynamicChannels.push(channelId);
    }
  }

  writeStore({
    hubs: remainingHubs,
    dynamicChannels: remainingDynamicChannels,
    logChannels: store.logChannels
  });
}

async function createVoiceHub(interaction) {
  const name = interaction.options.getString('nombre').trim();
  const categoryId = interaction.options.getString('categoria_id').trim();
  const category = await interaction.guild.channels.fetch(categoryId).catch(() => null);

  if (!isCategory(category)) {
    return interaction.reply({
      content: '❌ El `categoria_id` no corresponde a una categoría válida de este servidor.',
      ephemeral: true
    });
  }

  const channel = await interaction.guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: category.id
  });

  updateStore(store => {
    if (!store.hubs.some(hub => hub.channelId === channel.id)) {
      store.hubs.push({ guildId: interaction.guild.id, channelId: channel.id });
    }
  });

  await sendVoiceLog(
    interaction.guild.id,
    'Canal principal creado',
    `**Administrador:** ${interaction.user}\n**Canal:** <#${channel.id}>\n**Categoría:** ${category.name}`,
    0x57F287
  );

  return interaction.reply({
    content: `✅ Canal principal creado: <#${channel.id}>\nCuando alguien se una, se creará automáticamente su canal privado de voz.`,
    ephemeral: true
  });
}

async function configureLogChannel(interaction) {
  const channel = interaction.options.getChannel('canal');

  updateStore(store => {
    store.logChannels = store.logChannels.filter(log => log.guildId !== interaction.guild.id);
    store.logChannels.push({ guildId: interaction.guild.id, channelId: channel.id });
  });

  await interaction.reply({
    content: `✅ Los logs de voz se enviarán a <#${channel.id}>.`,
    ephemeral: true
  });

  await sendVoiceLog(
    interaction.guild.id,
    'Canal de logs configurado',
    `Los eventos de voz dinámicos se registrarán aquí: <#${channel.id}>.`,
    0x3498DB
  );
}

function findOwnedDynamicChannel(interaction) {
  const dynamicChannelIds = readStore().dynamicChannels;
  return interaction.guild.channels.cache.find(channel =>
    isVoiceChannel(channel) &&
    dynamicChannelIds.includes(channel.id) &&
    channel.permissionOverwrites.cache.get(interaction.user.id)?.allow.has(PermissionFlagsBits.ManageChannels)
  );
}

async function configureVoiceChannel(interaction) {
  const channel = findOwnedDynamicChannel(interaction);
  if (!channel) {
    return interaction.reply({
      content: '❌ No tienes un canal de voz dinámico activo.',
      ephemeral: true
    });
  }

  const name = interaction.options.getString('nombre');
  const userLimit = interaction.options.getInteger('limite');
  const changes = {};

  if (name) changes.name = name.trim();
  if (userLimit !== null) changes.userLimit = userLimit;

  if (Object.keys(changes).length === 0) {
    return interaction.reply({
      content: '❌ Debes indicar al menos un `nombre` o un `limite`.',
      ephemeral: true
    });
  }

  await channel.edit(changes);
  return interaction.reply({
    content: `✅ Canal actualizado: <#${channel.id}>`,
    ephemeral: true
  });
}

async function handleCommand(interaction) {
  if (interaction.commandName === 'crear-canal-voz') {
    try {
      return await createVoiceHub(interaction);
    } catch (error) {
      console.error('Error creando canal principal de voz:', error);
      return interaction.reply({ content: '❌ No se pudo crear el canal principal de voz.', ephemeral: true });
    }
  }

  if (interaction.commandName === 'configurar-mi-canal-voz') {
    try {
      return await configureVoiceChannel(interaction);
    } catch (error) {
      console.error('Error configurando canal de voz:', error);
      return interaction.reply({ content: '❌ No se pudo actualizar tu canal de voz.', ephemeral: true });
    }
  }

  if (interaction.commandName === 'configurar-logs-voz') {
    try {
      return await configureLogChannel(interaction);
    } catch (error) {
      console.error('Error configurando logs de voz:', error);
      return interaction.reply({ content: '❌ No se pudo configurar el canal de logs.', ephemeral: true });
    }
  }

  return false;
}

async function handleVoiceStateUpdate(oldState, newState) {
  const store = readStore();
  const joinedHub = newState.channel && getHubIds(newState.guild.id).includes(newState.channel.id);

  if (
    newState.channel &&
    store.dynamicChannels.includes(newState.channel.id) &&
    !newState.member.user.bot &&
    oldState.channel?.id !== newState.channel.id
  ) {
    await sendVoiceLog(
      newState.guild.id,
      'Usuario conectado a voz',
      `${newState.member} se unió a **${newState.channel.name}**.`,
      0x3498DB
    );
  }

  if (joinedHub && !newState.member.user.bot) {
    const existingChannel = newState.guild.channels.cache.find(channel =>
      isVoiceChannel(channel) &&
      store.dynamicChannels.includes(channel.id) &&
      channel.permissionOverwrites.cache.get(newState.member.id)?.allow.has(PermissionFlagsBits.ManageChannels)
    );

    if (existingChannel) {
      await newState.setChannel(existingChannel).catch(() => null);
    } else {
      const channel = await newState.guild.channels.create({
        name: `⨯﹒canal de ${newState.member.displayName}`.slice(0, 100),
        type: ChannelType.GuildVoice,
        parent: newState.channel.parentId,
        permissionOverwrites: [
          {
            id: newState.member.id,
            allow: [
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.Stream,
              PermissionFlagsBits.SendMessages
            ]
          }
        ]
      });

      updateStore(store => {
        store.dynamicChannels.push(channel.id);
      });

      await newState.setChannel(channel).catch(() => null);
      await sendVoiceGuide(channel, newState.member);
      await sendVoiceLog(
        newState.guild.id,
        'Canal dinámico creado',
        `${newState.member} se unió a **${newState.channel.name}**.\nCanal personal: <#${channel.id}>`,
        0x57F287
      );
    }
  }

  const oldChannel = oldState.channel;
  if (isVoiceChannel(oldChannel) && store.dynamicChannels.includes(oldChannel.id) && oldChannel.members.size === 0) {
    await sendVoiceLog(
      oldState.guild.id,
      'Canal dinámico cerrado',
      `${oldState.member} salió de **${oldChannel.name}** y el canal quedó vacío.`,
      0xED4245
    );
    await oldChannel.delete('Canal de voz dinámico vacío').catch(() => null);
    updateStore(store => {
      store.dynamicChannels = store.dynamicChannels.filter(channelId => channelId !== oldChannel.id);
    });
  }

  if (isVoiceChannel(oldChannel) && store.dynamicChannels.includes(oldChannel.id) && oldChannel.members.size > 0) {
    await sendVoiceLog(
      oldState.guild.id,
      'Usuario salió de voz',
      `${oldState.member} salió de **${oldChannel.name}**.`,
      0xFEE75C
    );
  }
}

function setupDynamicVoiceChannels(client) {
  discordClient = client;
  client.once('ready', () => cleanStoredChannels(client).catch(error => {
    console.error('Error limpiando canales de voz almacenados:', error);
  }));

  client.on('voiceStateUpdate', (oldState, newState) => {
    handleVoiceStateUpdate(oldState, newState).catch(error => {
      console.error('Error gestionando canales de voz dinámicos:', error);
    });
  });

  client.on('channelUpdate', (oldChannel, newChannel) => {
    handleChannelUpdate(oldChannel, newChannel).catch(error => {
      console.error('Error registrando modificación de canal de voz:', error);
    });
  });
}

module.exports = { handleCommand, setupDynamicVoiceChannels };
