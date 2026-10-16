const path = require('node:path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const config = require('../config');
const { createJsonStore } = require('../storage/jsonStore');

const MAX_TEAM_SIZE = 4;
const teamStore = createJsonStore(path.join(config.dataDirectory, 'team-roles.json'), {
  createDefault: () => ({ teams: [] }),
  normalize: store => {
    store.teams ||= [];
    return store;
  }
});
const readStore = teamStore.read;
const updateStore = teamStore.update;
const pendingTeams = new Map();

// role.members solo refleja la caché; se cargan los miembros del servidor
// para no tratar como vacío un equipo cuyos miembros no están cacheados.
async function fetchGuildMembers(guild) {
  await guild.members.fetch().catch(error => {
    console.error('No se pudieron cargar los miembros del servidor:', error);
  });
}

function getTeam(guildId, ownerId) {
  return readStore().teams.find(team => team.guildId === guildId && team.ownerId === ownerId);
}

function getTeamByRole(guildId, roleId) {
  return readStore().teams.find(team => team.guildId === guildId && team.roleId === roleId);
}

function getGuildTeams(guildId) {
  return readStore().teams.filter(team => team.guildId === guildId);
}

async function addMemberToRole(guild, role, memberId) {
  const member = await guild.members.fetch(memberId);
  return member.roles.add(role);
}

function parseColor(value) {
  const normalized = value.trim().replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized, 16) : null;
}

function teamEmbed(role, ownerId, memberIds) {
  const members = memberIds.map(memberId => `<@${memberId}>`).join(', ');
  return new EmbedBuilder()
    .setTitle(`Equipo ${role.name}`)
    .setColor(role.color || 0x5865F2)
    .setDescription(`Propietario: <@${ownerId}>\nMiembros actuales: ${members || 'ninguno'}`)
    .setFooter({ text: `Máximo ${MAX_TEAM_SIZE} personas contando al creador` });
}

function selectionComponents(customId) {
  return [
    new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(`Selecciona hasta ${MAX_TEAM_SIZE - 1} compañeros`)
        .setMinValues(0)
        .setMaxValues(MAX_TEAM_SIZE - 1)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('team_confirm')
        .setLabel('Guardar miembros')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('team_cancel')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

async function showMemberPicker(interaction, state, content) {
  pendingTeams.set(`${interaction.guild.id}:${interaction.user.id}`, state);
  return interaction.reply({
    content,
    embeds: [teamEmbed(state.role, state.ownerId, [state.ownerId, ...state.memberIds])],
    components: selectionComponents('team_members'),
    flags: MessageFlags.Ephemeral
  });
}

async function handleCreateCommand(interaction) {
  if (getTeam(interaction.guild.id, interaction.user.id)) {
    return interaction.reply({ content: '❌ Ya tienes un equipo. Usa `/gestionar-equipo` para modificarlo.', flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder().setCustomId('team_create_modal').setTitle('Registrar equipo');
  const name = new TextInputBuilder()
    .setCustomId('team_name')
    .setLabel('Nombre del equipo')
    .setPlaceholder('Ej. Los Recursivos')
    .setMaxLength(100)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  const color = new TextInputBuilder()
    .setCustomId('team_color')
    .setLabel('Color hexadecimal')
    .setPlaceholder('#F4511E')
    .setMinLength(6)
    .setMaxLength(7)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(color)
  );
  return interaction.showModal(modal);
}

async function handleManageCommand(interaction) {
  const team = getTeam(interaction.guild.id, interaction.user.id);
  if (!team) {
    return interaction.reply({ content: '❌ No tienes un equipo registrado. Usa `/crear-equipo` primero.', flags: MessageFlags.Ephemeral });
  }

  const role = await interaction.guild.roles.fetch(team.roleId).catch(() => null);
  if (!role) {
    updateStore(store => { store.teams = store.teams.filter(item => item.roleId !== team.roleId); });
    return interaction.reply({ content: '❌ El rol de tu equipo ya no existe. Puedes crear un equipo nuevo.', flags: MessageFlags.Ephemeral });
  }

  await fetchGuildMembers(interaction.guild);

  return showMemberPicker(
    interaction,
    {
      guildId: interaction.guild.id,
      roleId: role.id,
      ownerId: interaction.user.id,
      role,
      isNew: false,
      memberIds: [...role.members.keys()].filter(memberId => memberId !== interaction.user.id)
    },
    'Selecciona los compañeros que deben conservar el rol. El creador se conserva automáticamente.'
  );
}

async function handleListCommand(interaction) {
  const teams = getGuildTeams(interaction.guild.id);
  if (teams.length === 0) {
    return interaction.reply({ content: 'ℹ️ No hay equipos creados en este servidor.', flags: MessageFlags.Ephemeral });
  }

  await fetchGuildMembers(interaction.guild);

  const embeds = [];
  const validTeams = [];
  for (const team of teams) {
    const role = await interaction.guild.roles.fetch(team.roleId).catch(() => null);
    if (!role) continue;

    validTeams.push(team);
    const members = [...role.members.values()].map(member => `<@${member.id}>`).join(', ') || 'ninguno';
    embeds.push(new EmbedBuilder()
      .setTitle(`Equipo ${role.name}`)
      .setColor(role.color || 0x5865F2)
      .setDescription(`**Rol:** ${role}\n**Propietario:** <@${team.ownerId}>\n**Miembros:** ${members}`)
      .setFooter({ text: `${role.members.size}/${MAX_TEAM_SIZE} integrantes` }));
  }

  if (validTeams.length !== teams.length) {
    updateStore(store => {
      store.teams = store.teams.filter(team => validTeams.some(validTeam => validTeam.roleId === team.roleId));
    });
  }

  if (embeds.length === 0) {
    return interaction.reply({ content: 'ℹ️ No hay equipos válidos en este servidor.', flags: MessageFlags.Ephemeral });
  }

  for (let index = 0; index < embeds.length; index += 10) {
    const response = { embeds: embeds.slice(index, index + 10), flags: MessageFlags.Ephemeral };
    if (index === 0) {
      await interaction.reply(response);
    } else {
      await interaction.followUp(response);
    }
  }
}

async function handleDeleteCommand(interaction) {
  const selectedRole = interaction.options.getRole('equipo');
  const isManager = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
  const team = selectedRole
    ? getTeamByRole(interaction.guild.id, selectedRole.id)
    : getTeam(interaction.guild.id, interaction.user.id);

  if (!team) {
    return interaction.reply({
      content: selectedRole
        ? '❌ Ese rol no corresponde a un equipo registrado en este servidor.'
        : '❌ No tienes un equipo registrado. Un administrador puede indicar el rol con `equipo`.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (team.ownerId !== interaction.user.id && !isManager) {
    return interaction.reply({ content: '❌ Solo el propietario o un administrador puede eliminar este equipo.', flags: MessageFlags.Ephemeral });
  }

  const role = await interaction.guild.roles.fetch(team.roleId).catch(() => null);
  if (role) {
    try {
      await role.delete(`Equipo eliminado por ${interaction.user.tag}`);
    } catch (error) {
      console.error('Error eliminando rol de equipo:', error);
      return interaction.reply({ content: '❌ No se pudo eliminar el rol. Verifica que el bot tenga permiso y que su rol esté por encima del rol del equipo.', flags: MessageFlags.Ephemeral });
    }
  }

  updateStore(store => {
    store.teams = store.teams.filter(item => item.roleId !== team.roleId);
  });

  return interaction.reply({ content: `✅ El equipo ${role ? `**${role.name}** y su rol` : 'y su registro'} fueron eliminados.`, flags: MessageFlags.Ephemeral });
}

async function handleLeaveCommand(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const team = getGuildTeams(interaction.guild.id)
    .map(team => ({ team, role: member.roles.cache.get(team.roleId) }))
    .find(({ team, role }) => role && team.ownerId !== interaction.user.id);

  if (!team) {
    const ownedTeam = getTeam(interaction.guild.id, interaction.user.id);
    return interaction.reply({
      content: ownedTeam
        ? '❌ Eres el propietario del equipo. No puedes salirte; usa `/gestionar-equipo` o `/eliminar-equipo`.'
        : '❌ No formas parte de ningún equipo.',
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    await member.roles.remove(team.role, 'Miembro salió del equipo');
  } catch (error) {
    console.error('Error retirando miembro del equipo:', error);
    return interaction.reply({ content: '❌ No se pudo retirar tu rol del equipo. Verifica que el bot tenga `Manage Roles` y que su rol esté por encima del rol del equipo.', flags: MessageFlags.Ephemeral });
  }

  return interaction.reply({ content: `✅ Saliste del equipo **${team.role.name}**.`, flags: MessageFlags.Ephemeral });
}

async function handleModal(interaction) {
  if (interaction.customId !== 'team_create_modal') return false;

  const name = interaction.fields.getTextInputValue('team_name').trim();
  const color = parseColor(interaction.fields.getTextInputValue('team_color'));
  if (color === null) {
    return interaction.reply({ content: '❌ El color debe tener formato hexadecimal, por ejemplo `#F4511E`.', flags: MessageFlags.Ephemeral });
  }

  let role;
  try {
    role = await interaction.guild.roles.create({ name, color, reason: `Equipo creado por ${interaction.user.tag}` });
  } catch (error) {
    console.error('Error creando rol de equipo:', error);
    return interaction.reply({ content: `❌ No se pudo crear el rol del equipo (${error.code || 'error desconocido'}).`, flags: MessageFlags.Ephemeral });
  }

  try {
    updateStore(store => store.teams.push({ guildId: interaction.guild.id, roleId: role.id, ownerId: interaction.user.id }));
  } catch (error) {
    console.error('Error guardando equipo:', error);
    await role.delete('No se pudo guardar el registro del equipo').catch(() => null);
    return interaction.reply({ content: '❌ El rol se creó, pero no se pudo guardar el equipo en `data/team-roles.json`.', flags: MessageFlags.Ephemeral });
  }

  try {
    const botMember = await interaction.guild.members.fetchMe();
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      throw new Error('El bot no tiene el permiso Manage Roles');
    }
    if (!role.editable || role.position >= botMember.roles.highest.position) {
      throw new Error('El rol del bot debe estar por encima del rol del equipo');
    }

    await member.roles.add(role);
  } catch (error) {
    console.error('Error asignando rol de equipo:', error);
    return interaction.reply({ content: `⚠️ El rol se creó, pero no se pudo asignar a tu usuario: ${error.message || error.code || 'error desconocido'}.`, flags: MessageFlags.Ephemeral });
  }

  return showMemberPicker(
    interaction,
    { guildId: interaction.guild.id, roleId: role.id, ownerId: interaction.user.id, role, isNew: true, memberIds: [] },
    'Rol creado. Selecciona los compañeros y pulsa **Guardar miembros**.'
  );
}

async function handleMemberSelect(interaction) {
  if (interaction.customId !== 'team_members') return false;
  const key = `${interaction.guild.id}:${interaction.user.id}`;
  const state = pendingTeams.get(key);
  const storedTeam = getTeam(interaction.guild.id, interaction.user.id);
  if (!state || !storedTeam || state.roleId !== storedTeam.roleId) {
    return interaction.update({ content: '❌ Esta configuración expiró. Ejecuta el comando de nuevo.', embeds: [], components: [] });
  }

  state.memberIds = interaction.values.filter(memberId => memberId !== state.ownerId).slice(0, MAX_TEAM_SIZE - 1);
  pendingTeams.set(key, state);
  return interaction.update({
    content: 'Revisa la lista y pulsa **Guardar miembros** para aplicar los cambios.',
    embeds: [teamEmbed(state.role, state.ownerId, [state.ownerId, ...state.memberIds])],
    components: selectionComponents('team_members')
  });
}

async function handleButton(interaction) {
  if (!['team_confirm', 'team_cancel'].includes(interaction.customId)) return false;
  const key = `${interaction.guild.id}:${interaction.user.id}`;
  const state = pendingTeams.get(key);
  if (!state) return interaction.update({ content: '❌ Esta configuración expiró. Ejecuta el comando de nuevo.', embeds: [], components: [] });

  pendingTeams.delete(key);
  if (interaction.customId === 'team_cancel') {
    // Solo se descarta el rol si el equipo se acaba de crear; cancelar
    // /gestionar-equipo no debe eliminar un equipo existente.
    if (state.isNew) {
      updateStore(store => { store.teams = store.teams.filter(team => team.roleId !== state.roleId); });
      await state.role.delete('Registro de equipo cancelado').catch(() => null);
    }
    return interaction.update({ content: 'Operación cancelada.', embeds: [], components: [] });
  }

  const role = await interaction.guild.roles.fetch(state.roleId).catch(() => null);
  if (!role) return interaction.update({ content: '❌ El rol ya no existe.', embeds: [], components: [] });

  const desired = new Set([state.ownerId, ...state.memberIds]);
  for (const member of role.members.values()) {
    if (!desired.has(member.id)) await member.roles.remove(role).catch(() => null);
  }
  for (const memberId of desired) await addMemberToRole(interaction.guild, role, memberId).catch(() => null);
  return interaction.update({
    content: `✅ Equipo actualizado. ${role} tiene ${desired.size}/${MAX_TEAM_SIZE} integrantes.`,
    embeds: [teamEmbed(role, state.ownerId, [...desired])],
    components: []
  });
}

// Solo revisa los equipos del miembro que salió, y con la lista completa de
// miembros cargada, para no borrar equipos que solo parecían vacíos en caché.
async function handleMemberRemove(member) {
  const teams = readStore().teams.filter(team =>
    team.guildId === member.guild.id && member.roles.cache.has(team.roleId));
  if (teams.length === 0) return;

  await member.guild.members.fetch();
  for (const team of teams) {
    const role = member.guild.roles.cache.get(team.roleId);
    if (role?.members.size === 0) {
      await role.delete('Equipo sin miembros').catch(() => null);
      updateStore(store => { store.teams = store.teams.filter(item => item.roleId !== team.roleId); });
    }
  }
}

async function handleRoleDelete(role) {
  if (!getTeamByRole(role.guild.id, role.id)) return;
  updateStore(store => { store.teams = store.teams.filter(team => team.roleId !== role.id); });
}

function setupTeams(client) {
  client.on('guildMemberRemove', member => handleMemberRemove(member).catch(error => console.error('Error limpiando equipo:', error)));
  client.on('roleDelete', role => handleRoleDelete(role).catch(error => console.error('Error actualizando equipos:', error)));
}

module.exports = {
  handleCreateCommand,
  handleManageCommand,
  handleListCommand,
  handleDeleteCommand,
  handleLeaveCommand,
  handleModal,
  handleMemberSelect,
  handleButton,
  setupTeams
};
