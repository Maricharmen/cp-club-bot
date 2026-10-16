const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const students = require('../services/students');
const sessionRecords = require('../services/sessionRecords');
const { getActiveCycle, getCycleSessions } = require('../services/cycles');
const { RANKS_DESCENDING, findRankByName, groupStudentsByRank, minVisibleXp } = require('../domain/ranks');
const { parseScore } = require('../domain/xp');

const PAGE_SIZE = 15;
const TOP_PER_RANK = 3;
const PAGINATION_TIMEOUT_MS = 10 * 60 * 1000;
const SEPARATOR = '━━━━━━━━━━━━━━━━━━━━━━━━━';

async function loadCycleStandings(cycleId) {
  const { data: estudiantes, error: errEst } = await students.listActiveStudents('id, nombre, codeforces_handle');
  const { data: sesionesCiclo, error: errSesiones } = await getCycleSessions(cycleId);
  if (errEst || errSesiones) return null;

  const { data: registros, error: errReg } = await sessionRecords.listRecordsForSessions(
    sesionesCiclo.map(sesion => sesion.id)
  );
  if (errReg) return null;

  const statsPorEstudiante = new Map(estudiantes.map(est => [est.id, {
    id: est.id,
    nombre: est.nombre,
    handle: est.codeforces_handle || null,
    puntos: 0
  }]));

  registros.forEach(r => {
    const stats = statsPorEstudiante.get(r.estudiante_id);
    if (stats) stats.puntos += parseScore(r.puntaje_actividad);
  });

  // Solo aparecen estudiantes con al menos 1 XP.
  return [...statsPorEstudiante.values()].filter(est => est.puntos > 0);
}

async function replyWithRankDetail(interaction, rankConfig, estudiantesEnRango) {
  const totalPages = Math.max(1, Math.ceil(estudiantesEnRango.length / PAGE_SIZE));

  const renderRankPage = page => {
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * PAGE_SIZE;
    const pageItems = estudiantesEnRango.slice(start, start + PAGE_SIZE);

    // La clasificación va en la descripción (hasta 4096 caracteres): 15 filas
    // pueden superar el límite de 1024 de un campo.
    const clasificacion = pageItems.length > 0
      ? pageItems.map(item => {
        const handleStr = item.handle ? `(\`@${item.handle}\`)` : '';
        return `\`#${item.position}\` **${item.nombre}** ${handleStr} ➔ **${item.puntos.toFixed(1)} XP**`;
      }).join('\n')
      : '_No hay estudiantes con puntaje registrado en este rango aún._';

    const embed = new EmbedBuilder()
      .setTitle(`${rankConfig.badge} Rango ${rankConfig.name.toUpperCase()}`)
      .setColor(rankConfig.color)
      .setDescription(
        `**Umbral:** \`${minVisibleXp(rankConfig)} - ${rankConfig.maxXP} XP\`\n` +
        `**Estudiantes clasificados:** \`${estudiantesEnRango.length}\`\n` +
        `**Página:** \`${safePage}/${totalPages}\`\n` +
        `${SEPARATOR}\n` +
        `**🏆 Clasificación**\n${clasificacion}`
      )
      .setFooter({ text: 'CPC Ranking System' })
      .setTimestamp();

    return { embed, safePage };
  };

  const renderControls = page => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`leaderboard_page:${rankConfig.name}:prev:${page}`)
      .setLabel('Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`leaderboard_page:${rankConfig.name}:next:${page}`)
      .setLabel('Siguiente')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= totalPages)
  );

  const firstPage = renderRankPage(1);
  const response = await interaction.editReply({
    embeds: [firstPage.embed],
    components: [renderControls(firstPage.safePage)]
  });

  const collector = response.createMessageComponentCollector({ time: PAGINATION_TIMEOUT_MS });
  collector.on('collect', async buttonInteraction => {
    try {
      const [, , direction, currentPageText] = buttonInteraction.customId.split(':');
      const currentPage = Number.parseInt(currentPageText, 10);
      const page = renderRankPage(direction === 'next' ? currentPage + 1 : currentPage - 1);

      await buttonInteraction.update({
        embeds: [page.embed],
        components: [renderControls(page.safePage)]
      });
    } catch (error) {
      console.error('Error paginando el leaderboard:', error);
    }
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => null);
  });
}

function buildGlobalEmbed(listaEstudiantes, rangosAgrupados) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 CPC LEADERBOARD OFICIAL')
    .setColor(0xF1C40F)
    .setDescription(
      `**Sistema de Clasificación por Rangos**\n` +
      `Estudiantes activos en la tabla: \`${listaEstudiantes.length}\`\n\n` +
      `Usa \`/leaderboard rango:<Rango>\` para ver el detalle de un nivel.\n` +
      SEPARATOR
    )
    .setFooter({ text: 'CPC Ranking System' })
    .setTimestamp();

  for (const rank of RANKS_DESCENDING) {
    const grupo = rangosAgrupados[rank.name] || [];
    let valorCampo = '_0 estudiantes en este rango_';

    if (grupo.length > 0) {
      const topList = grupo.slice(0, TOP_PER_RANK).map(
        s => `\`#${s.position}\` **${s.nombre}** ➔ \`${s.puntos.toFixed(1)} XP\``
      ).join('\n');
      const restantes = grupo.length - TOP_PER_RANK;
      valorCampo = `${topList}${restantes > 0 ? `\n_...y ${restantes} más (usa /leaderboard rango:${rank.name})_` : ''}`;
    }

    embed.addFields({
      name: `${rank.badge} ${rank.name.toUpperCase()} (${grupo.length}) • [${minVisibleXp(rank)} - ${rank.maxXP} XP]`,
      value: valorCampo,
      inline: false
    });
  }

  return embed;
}

// /leaderboard
async function handleLeaderboardCommand(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { data: cicloActivo, error: errCiclo } = await getActiveCycle();
  if (errCiclo || !cicloActivo) {
    return interaction.editReply('❌ No hay un ciclo académico activo configurado.');
  }

  const listaEstudiantes = await loadCycleStandings(cicloActivo.id);
  if (!listaEstudiantes) {
    return interaction.editReply('❌ Error al consultar los datos del ranking.');
  }

  const rangosAgrupados = groupStudentsByRank(listaEstudiantes);
  const filtroRango = interaction.options.getString('rango');

  if (filtroRango) {
    const rankConfig = findRankByName(filtroRango);
    if (!rankConfig) {
      return interaction.editReply(`❌ El rango \`${filtroRango}\` no existe.`);
    }
    return replyWithRankDetail(interaction, rankConfig, rangosAgrupados[rankConfig.name] || []);
  }

  return interaction.editReply({ embeds: [buildGlobalEmbed(listaEstudiantes, rangosAgrupados)] });
}

module.exports = {
  commands: {
    leaderboard: handleLeaderboardCommand
  }
};
