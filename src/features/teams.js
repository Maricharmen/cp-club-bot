const fs = require('node:fs');
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
  MessageFlags
} = require('discord.js');

const DATA_DIRECTORY = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIRECTORY, 'team-roles.json');
const pendingTeams = new Map();

function readStore() {
  try {
    const store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    store.teams ||= [];
    return store;
  } catch (error) {
    if (error.code === 'ENOENT') return { teams: [] };
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

function getTeam(guildId, ownerId) {
  return readStore().teams.find(team => team.guildId === guildId && team.ownerId === ownerId);
}

function getTeamByRole(guildId, roleId) {
  return readStore().teams.find(team => team.guildId === guildId && team.roleId === roleId);
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
    .setFooter({ text: 'Máximo 3 personas contando al creador' });
}

function selectionComponents(customId) {
  return [
    new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder('Selecciona hasta 2 compañeros')
        .setMinValues(0)
        .setMaxValues(2)
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

  return showMemberPicker(
    interaction,
    {
      guildId: interaction.guild.id,
      roleId: role.id,
      ownerId: interaction.user.id,
      role,
      memberIds: [...role.members.keys()].filter(memberId => memberId !== interaction.user.id)
    },
    'Selecciona los compañeros que deben conservar el rol. El creador se conserva automáticamente.'
  );
}

async function handleModal(interaction) {
  if (interaction.customId !== 'team_create_modal') return false;

  const name = interaction.fields.getTextInputValue('team_name').trim();
  const color = parseColor(interaction.fields.getTextInputValue('team_color'));
  if (color === null) {
    return interaction.reply({ content: '❌ El color debe tener formato hexadecimal, por ejemplo `#F4511E`.', flags: MessageFlags.Ephemeral });
  }

  try {
    const role = await interaction.guild.roles.create({ name, color, reason: `Equipo creado por ${interaction.user.tag}` });
    updateStore(store => store.teams.push({ guildId: interaction.guild.id, roleId: role.id, ownerId: interaction.user.id }));
    await role.members.add(interaction.user.id);
    return showMemberPicker(
      interaction,
      { guildId: interaction.guild.id, roleId: role.id, ownerId: interaction.user.id, role, memberIds: [] },
      'Rol creado. Selecciona hasta 2 compañeros y pulsa **Guardar miembros**.'
    );
  } catch (error) {
    console.error('Error creando equipo:', error);
    return interaction.reply({ content: '❌ No se pudo crear el equipo. Verifica que el bot pueda administrar roles.', flags: MessageFlags.Ephemeral });
  }
}

async function handleMemberSelect(interaction) {
  if (interaction.customId !== 'team_members') return false;
  const key = `${interaction.guild.id}:${interaction.user.id}`;
  const state = pendingTeams.get(key);
  const storedTeam = getTeam(interaction.guild.id, interaction.user.id);
  if (!state || !storedTeam || state.roleId !== storedTeam.roleId) {
    return interaction.update({ content: '❌ Esta configuración expiró. Ejecuta el comando de nuevo.', embeds: [], components: [] });
  }

  state.memberIds = interaction.values.filter(memberId => memberId !== state.ownerId).slice(0, 2);
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
    updateStore(store => { store.teams = store.teams.filter(team => team.roleId !== state.roleId); });
    await state.role.delete('Registro de equipo cancelado').catch(() => null);
    return interaction.update({ content: 'Operación cancelada.', embeds: [], components: [] });
  }

  const role = await interaction.guild.roles.fetch(state.roleId).catch(() => null);
  if (!role) return interaction.update({ content: '❌ El rol ya no existe.', embeds: [], components: [] });

  const desired = new Set([state.ownerId, ...state.memberIds]);
  for (const member of role.members.values()) {
    if (!desired.has(member.id)) await member.roles.remove(role).catch(() => null);
  }
  for (const memberId of desired) await role.members.add(memberId).catch(() => null);
  return interaction.update({
    content: `✅ Equipo actualizado. ${role} tiene ${desired.size}/3 integrantes.`,
    embeds: [teamEmbed(role, state.ownerId, [...desired])],
    components: []
  });
}

async function handleMemberRemove(member) {
  const teams = readStore().teams.filter(team => team.guildId === member.guild.id);
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

module.exports = { handleCreateCommand, handleManageCommand, handleModal, handleMemberSelect, handleButton, setupTeams };
