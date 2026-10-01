const { ChannelType, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('vincular')
    .setDescription('Vincula tu cuenta de Discord con tu correo y handle de Codeforces')
    .addStringOption(opt => opt.setName('correo').setDescription('Tu correo institucional registrado').setRequired(true))
    .addStringOption(opt => opt.setName('codeforces').setDescription('Tu handle de Codeforces (opcional)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('asistencia')
    .setDescription('Registra tu asistencia con el código temporal de la sesión')
    .addStringOption(opt => opt.setName('codigo').setDescription('Código de 6 caracteres proporcionado por el mentor').setRequired(true)),

  new SlashCommandBuilder()
    .setName('mi-progreso')
    .setDescription('Consulta tu porcentaje de asistencia, puntajes acumulados y feedback recibido'),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Muestra la tabla de clasificación por puntaje de actividades y asistencia')
    .addStringOption(opt => opt.setName('programa').setDescription('Filtrar por track o ver el ranking global').setRequired(false).addChoices(
      { name: '🌐 General', value: 'GENERAL' },
      { name: '💻 CPC', value: 'CPC' },
      { name: '💼 HUB', value: 'HUB' }
    )),

  new SlashCommandBuilder()
    .setName('iniciar-sesion')
    .setDescription('Abre la toma de asistencia para una clase o workshop')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(opt => opt.setName('sesion_id').setDescription('ID numérico de la sesión en Supabase').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutos').setDescription('Minutos de duración activa del código (default: 15)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('resumen-sesion')
    .setDescription('Muestra la asistencia en tiempo real de una sesión (presentes, ausentes y quórum)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(opt => opt.setName('sesion_id').setDescription('ID de la sesión').setRequired(true)),

  new SlashCommandBuilder()
    .setName('calificar-mock')
    .setDescription('Asigna puntaje y retroalimentación de una Mock Interview a un estudiante')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName('correo').setDescription('Correo institucional del estudiante').setRequired(true))
    .addIntegerOption(opt => opt.setName('sesion_id').setDescription('ID de la sesión de Mock Interview').setRequired(true))
    .addNumberOption(opt => opt.setName('puntaje').setDescription('Puntaje obtenido (ej. 0 a 100)').setRequired(true))
    .addStringOption(opt => opt.setName('feedback').setDescription('Comentarios, fortalezas y áreas de mejora').setRequired(true)),

  new SlashCommandBuilder()
    .setName('calificar-concurso')
    .setDescription('Registra manualmente el puntaje o problemas resueltos de un concurso')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName('correo').setDescription('Correo institucional del estudiante').setRequired(true))
    .addIntegerOption(opt => opt.setName('sesion_id').setDescription('ID de la sesión del concurso').setRequired(true))
    .addNumberOption(opt => opt.setName('puntaje').setDescription('Puntos o problemas resueltos').setRequired(true))
    .addStringOption(opt => opt.setName('feedback').setDescription('Feedback o notas sobre el desempeño (opcional)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('justificar-falta')
    .setDescription('Registra una falta justificada con motivo a un estudiante')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName('correo').setDescription('Correo institucional del estudiante').setRequired(true))
    .addIntegerOption(opt => opt.setName('sesion_id').setDescription('ID de la sesión').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo de la justificación').setRequired(true)),

  new SlashCommandBuilder()
    .setName('sincronizar-codeforces')
    .setDescription('Sincroniza puntos de un contest o lista de problemas públicos de Codeforces')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(opt => opt.setName('sesion_id').setDescription('ID de la sesión en Supabase').setRequired(true))
    .addStringOption(opt => opt.setName('problemas').setDescription('Nombres o códigos separados por coma (ej: 158A, 71A)').setRequired(false))
    .addIntegerOption(opt => opt.setName('contest_id').setDescription('ID del contest público (opcional)').setRequired(false))
    .addNumberOption(opt => opt.setName('puntos_por_problema').setDescription('Puntos por cada AC (default: 10)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('importar-standings')
    .setDescription('Abre una ventana para pegar el texto de Standings y calificar en lote')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(opt => opt.setName('sesion_id').setDescription('ID de la sesión en Supabase').setRequired(true))
    .addNumberOption(opt => opt.setName('puntos_por_problema').setDescription('Puntos por cada AC (default: 20)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('crear-canal-voz')
    .setDescription('Crea un canal principal que genera canales de voz automáticamente')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt => opt.setName('nombre').setDescription('Nombre del canal principal').setRequired(true))
    .addStringOption(opt => opt.setName('categoria_id').setDescription('ID de la categoría donde se creará').setRequired(true)),

  new SlashCommandBuilder()
    .setName('configurar-mi-canal-voz')
    .setDescription('Cambia el nombre o límite de usuarios de tu canal de voz')
    .addStringOption(opt => opt.setName('nombre').setDescription('Nuevo nombre del canal').setRequired(false))
    .addIntegerOption(opt => opt.setName('limite').setDescription('Límite de usuarios, de 0 a 99 (0 = sin límite)').setMinValue(0).setMaxValue(99).setRequired(false)),

  new SlashCommandBuilder()
    .setName('configurar-logs-voz')
    .setDescription('Define el canal donde se registrarán los eventos de voz dinámicos')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt => opt
      .setName('canal')
      .setDescription('Canal de texto para los logs')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)),

  new SlashCommandBuilder()
    .setName('crear-equipo')
    .setDescription('Crea un equipo de hasta 3 personas con nombre y color personalizados'),

  new SlashCommandBuilder()
    .setName('gestionar-equipo')
    .setDescription('Modifica los compañeros que forman parte de tu equipo')
].map(command => command.toJSON());

module.exports = commands;
