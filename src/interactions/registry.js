// Tabla única que asocia cada slash command y componente con su handler.
// Al agregar un comando en src/commands.js, regístralo aquí (la prueba
// test/registry.test.js falla si alguno queda sin handler).

const help = require('../features/help');
const linking = require('../features/linking');
const attendance = require('../features/attendance');
const progress = require('../features/progress');
const leaderboard = require('../features/leaderboard');
const grading = require('../features/grading');
const contestImport = require('../features/contestImport');
const teams = require('../features/teams');
const birthdays = require('../features/birthdays');
const dynamicVoiceChannels = require('../features/dynamicVoiceChannels');

const commandHandlers = {
  help: help.handleCommand,

  ...linking.commands,
  ...attendance.commands,
  ...progress.commands,
  ...leaderboard.commands,
  ...grading.commands,
  ...contestImport.commands,

  'crear-equipo': teams.handleCreateCommand,
  'gestionar-equipo': teams.handleManageCommand,
  'salir-equipo': teams.handleLeaveCommand,
  'listar-equipos': teams.handleListCommand,
  'eliminar-equipo': teams.handleDeleteCommand,

  cumpleanos: birthdays.handleCommand,
  'configurar-canal-cumpleanos': birthdays.handleCommand,
  'listar-cumpleanos': birthdays.handleCommand,

  'crear-canal-voz': dynamicVoiceChannels.handleCommand,
  'configurar-mi-canal-voz': dynamicVoiceChannels.handleCommand,
  'configurar-logs-voz': dynamicVoiceChannels.handleCommand
};

// Botones, menús y modals. Los botones de paginación del leaderboard no están
// aquí porque los atiende un collector dentro del propio comando.
const componentRoutes = [
  { matches: i => i.isModalSubmit() && i.customId === 'team_create_modal', handle: teams.handleModal },
  ...contestImport.modals.map(route => ({
    matches: i => i.isModalSubmit() && route.matches(i.customId),
    handle: route.handle
  })),
  { matches: i => i.isUserSelectMenu() && i.customId === 'team_members', handle: teams.handleMemberSelect },
  { matches: i => i.isButton() && ['team_confirm', 'team_cancel'].includes(i.customId), handle: teams.handleButton },
  { matches: i => i.isButton() && i.customId.startsWith('help:'), handle: help.handleButton }
];

module.exports = { commandHandlers, componentRoutes };
