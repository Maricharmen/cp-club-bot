const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');

const pages = [
  {
    title: 'Comandos para todos',
    color: 0x3498DB,
    description: 'Funciones disponibles para cualquier miembro del servidor.',
    commands: [
      ['/help', 'Abre esta ayuda interactiva y navega entre sus secciones.'],
      ['/vincular', 'Vincula tu cuenta de Discord con tu correo y handle de Codeforces.'],
      ['/asistencia', 'Registra tu asistencia con el código de la sesión activa.'],
      ['/mi-progreso', 'Consulta tu asistencia, puntos y feedback acumulado.'],
      ['/leaderboard', 'Muestra el ranking general o filtrado por programa.'],
      ['/configurar-mi-canal-voz', 'Cambia el nombre o límite de tu canal de voz personal.']
    ]
  },
  {
    title: 'Equipos y cumpleaños',
    color: 0xF1C40F,
    description: 'Organiza equipos y mantén visibles los cumpleaños del servidor.',
    commands: [
      ['/crear-equipo', 'Crea un equipo de hasta 4 integrantes con nombre y color.'],
      ['/gestionar-equipo', 'El propietario cambia los compañeros que conservan el rol.'],
      ['/salir-equipo', 'Permite a un miembro salir de un equipo sin eliminarlo.'],
      ['/listar-equipos', 'Muestra los equipos, propietarios y miembros actuales.'],
      ['/eliminar-equipo', 'El propietario o un administrador elimina un equipo y su rol.'],
      ['/cumpleanos', 'Registra o actualiza tu cumpleaños usando mes y día.'],
      ['/listar-cumpleanos', 'Muestra los cumpleaños registrados del mes indicado.'],
      ['/configurar-canal-cumpleanos', 'Administrador: elige dónde se envían los recordatorios.', PermissionFlagsBits.ManageGuild]
    ]
  },
  {
    title: 'Administración',
    color: 0xE67E22,
    description: 'Comandos para mentores y administradores del servidor.',
    commands: [
      ['/iniciar-sesion', 'Abre una sesión de asistencia y genera su código temporal.', PermissionFlagsBits.ManageGuild],
      ['/resumen-sesion', 'Muestra presentes, ausentes y quórum de una sesión.', PermissionFlagsBits.ManageGuild],
      ['/calificar-mock', 'Registra la calificación y feedback de una Mock Interview.', PermissionFlagsBits.ManageGuild],
      ['/calificar-concurso', 'Registra manualmente puntos de un concurso.', PermissionFlagsBits.ManageGuild],
      ['/justificar-falta', 'Registra una ausencia justificada con su motivo.', PermissionFlagsBits.ManageGuild],
      ['/sincronizar-codeforces', 'Sincroniza puntos desde Codeforces.', PermissionFlagsBits.ManageGuild],
      ['/importar-standings', 'Importa resultados pegando la tabla de standings.', PermissionFlagsBits.ManageGuild],
      ['/crear-canal-voz', 'Crea un canal principal de voz dinámico.', PermissionFlagsBits.ManageChannels],
      ['/configurar-logs-voz', 'Configura el canal de auditoría de voz.', PermissionFlagsBits.ManageGuild]
    ]
  }
];

function getVisiblePages(interaction) {
  const permissions = interaction.memberPermissions;
  return pages
    .map(page => ({
      ...page,
      commands: page.commands.filter(([, , requiredPermission]) =>
        !requiredPermission || permissions?.has(requiredPermission))
    }))
    .filter(page => page.commands.length > 0);
}

function buildHelpMessage(pageIndex, interaction) {
  const visiblePages = getVisiblePages(interaction);
  const page = visiblePages[pageIndex] || visiblePages[0];
  const currentPage = page === visiblePages[pageIndex] ? pageIndex : 0;
  const embed = new EmbedBuilder()
    .setTitle(`📚 Ayuda del CP Club • ${page.title}`)
    .setColor(page.color)
    .setDescription(page.description)
    .addFields(page.commands.map(([name, description]) => ({
      name,
      value: description,
      inline: false
    })))
    .setFooter({ text: `Sección ${currentPage + 1} de ${visiblePages.length} • Usa los botones para navegar` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help:previous:${pageIndex}`)
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`help:next:${pageIndex}`)
      .setLabel('Siguiente')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === visiblePages.length - 1),
    new ButtonBuilder()
      .setCustomId('help:close')
      .setLabel('Cerrar')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row], flags: MessageFlags.Ephemeral };
}

async function handleCommand(interaction) {
  if (interaction.commandName !== 'help') return null;
  return interaction.reply(buildHelpMessage(0, interaction));
}

async function handleButton(interaction) {
  if (!interaction.customId.startsWith('help:')) return false;

  if (interaction.customId === 'help:close') {
    return interaction.update({ embeds: [], components: [], content: 'Ayuda cerrada.' });
  }

  const [, direction, currentPageValue] = interaction.customId.split(':');
  const currentPage = Number.parseInt(currentPageValue, 10);
  const offset = direction === 'next' ? 1 : -1;
  const nextPage = currentPage + offset;
  const visiblePages = getVisiblePages(interaction);

  if (!Number.isInteger(currentPage) || !visiblePages[nextPage]) {
    return interaction.update(buildHelpMessage(0, interaction));
  }

  return interaction.update(buildHelpMessage(nextPage, interaction));
}

module.exports = { handleCommand, handleButton };
