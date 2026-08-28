// index.js
require('./src/config');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} = require('discord.js');
const supabase = require('./src/services/supabase');
const { createDiscordClient } = require('./src/client');
const { generarCodigoOTP } = require('./src/utils');
const dynamicVoiceChannels = require('./src/features/dynamicVoiceChannels');

// ==========================================
// 1. INICIALIZACIÓN
// ==========================================
const client = createDiscordClient();
dynamicVoiceChannels.setupDynamicVoiceChannels(client);

client.once('ready', () => {
  console.log(`🤖 CP Club Bot conectado exitosamente como: ${client.user.tag}`);
});

// ==========================================
// 2. MANEJADOR DE INTERACCIONES
// ==========================================
client.on('interactionCreate', async (interaction) => {

  // ----------------------------------------------------
  // A. MANEJO DE MODALS (/importar-standings Multi-Formato)
  // ----------------------------------------------------
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('modal_standings_')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const [, , sesionIdStr, puntosStr] = interaction.customId.split('_');
      const sesionId = parseInt(sesionIdStr, 10);
      const puntosPorProblema = parseFloat(puntosStr);
      const textoRaw = interaction.fields.getTextInputValue('standings_raw_text');

      try {
        const { data: sesion, error: errSes } = await supabase
          .from('sesiones')
          .select('id, nombre, programa')
          .eq('id', sesionId)
          .maybeSingle();

        if (errSes || !sesion) {
          return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
        }

        const { data: estudiantes, error: errEst } = await supabase
          .from('estudiantes')
          .select('id, nombre, codeforces_handle')
          .not('codeforces_handle', 'is', null)
          .eq('status', 'ACTIVO');

        if (errEst || !estudiantes || estudiantes.length === 0) {
          return interaction.editReply('⚠️ No hay estudiantes con handle de Codeforces en la base de datos.');
        }

        const mapaHandles = new Map();
        estudiantes.forEach(e => mapaHandles.set(e.codeforces_handle.trim().toLowerCase(), e));

        const lineas = textoRaw.split(/\r?\n/);
        const actualizados = [];

        for (let linea of lineas) {
          linea = linea.trim();
          if (!linea) continue;

          if (/^(#|Rank|Who|Penalty|User|=|Score|Handle|Participante|Nombre)/i.test(linea)) continue;

          const tokens = linea.split(/[\s,;:\t|]+/).filter(Boolean);
          if (tokens.length === 0) continue;

          let estudianteEncontrado = null;
          let indiceHandle = -1;

          for (let i = 0; i < tokens.length; i++) {
            const tokenLimpio = tokens[i].replace(/^[#@.(-]+|[).,-]+$/g, '').toLowerCase();
            if (mapaHandles.has(tokenLimpio)) {
              estudianteEncontrado = mapaHandles.get(tokenLimpio);
              indiceHandle = i;
              break;
            }
          }

          if (!estudianteEncontrado) continue;

          let problemasAC = null;
          const tokensRestantes = tokens.slice(indiceHandle + 1);

          for (const tok of tokensRestantes) {
            const numeroLimpio = tok.replace(/^[=]+/, '');
            if (/^\d+$/.test(numeroLimpio)) {
              problemasAC = parseInt(numeroLimpio, 10);
              break;
            }
          }

          if (problemasAC === null) {
            const conteoPlus = tokensRestantes.filter(tok => tok.startsWith('+')).length;
            if (conteoPlus > 0) {
              problemasAC = conteoPlus;
            }
          }

          if (problemasAC === null) problemasAC = 0;

          const puntosFinales = problemasAC * puntosPorProblema;

          const { data: regPrevio } = await supabase
            .from('registro_sesion')
            .select('asistencia')
            .eq('sesion_id', sesion.id)
            .eq('estudiante_id', estudianteEncontrado.id)
            .maybeSingle();

          const estadoAsistencia = regPrevio?.asistencia || 'PRESENTE';

          await supabase
            .from('registro_sesion')
            .upsert(
              {
                sesion_id: sesion.id,
                estudiante_id: estudianteEncontrado.id,
                asistencia: estadoAsistencia,
                puntaje_actividad: puntosFinales,
                feedback: `Práctica: ${problemasAC} AC resueltos (${puntosFinales.toFixed(1)} pts)`,
                registrado_en: new Date().toISOString()
              },
              { onConflict: 'sesion_id,estudiante_id' }
            );

          actualizados.push({
            nombre: estudianteEncontrado.nombre,
            handle: estudianteEncontrado.codeforces_handle,
            ac: problemasAC,
            puntos: puntosFinales
          });
        }

        if (actualizados.length === 0) {
          return interaction.editReply(
            '⚠️ No se encontró ningún estudiante vinculado en el texto ingresado.\n' +
            'Verifica que los handles coincidan con los registrados con `/vincular`.'
          );
        }

        const listaFormateada = actualizados.map(
          a => `• **${a.nombre}** (\`@${a.handle}\`) ➔ **${a.ac} AC** (\`${a.puntos.toFixed(1)} pts\`)`
        ).join('\n');

        const embed = new EmbedBuilder()
          .setTitle('⚡ Standings Importados Exitosamente')
          .setColor(0x00A86B)
          .setDescription(
            `**Sesión:** ${sesion.nombre} (ID: \`${sesion.id}\`)\n` +
            `**Factor:** \`${puntosPorProblema} pts por problema resuelto\`\n\n` +
            `**Resultados Procesados (${actualizados.length}):**\n${listaFormateada}`
          )
          .setFooter({ text: 'CPC Concurso Sync • Standings Parser' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });

      } catch (err) {
        console.error('Error importando standings:', err);
        return interaction.editReply('❌ Error inesperado al procesar los resultados.');
      }
    }
    return;
  }

  // ----------------------------------------------------
  // B. MANEJO DE SLASH COMMANDS
  // ----------------------------------------------------
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'crear-canal-voz' || commandName === 'configurar-mi-canal-voz' || commandName === 'configurar-logs-voz') {
    return dynamicVoiceChannels.handleCommand(interaction);
  }

  // 1. /vincular
  if (commandName === 'vincular') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const correoInput = options.getString('correo').trim().toLowerCase();
    const codeforcesInput = options.getString('codeforces')?.trim() || null;
    const discordId = interaction.user.id;

    try {
      const { data: estudiante, error: errorBusqueda } = await supabase
        .from('estudiantes')
        .select('*')
        .ilike('correo', correoInput)
        .maybeSingle();

      if (errorBusqueda || !estudiante) {
        return interaction.editReply(
          `❌ No se encontró ningún registro para el correo \`${correoInput}\`.\nVerifica que esté escrito correctamente o contacta a un mentor.`
        );
      }

      const updateData = {
        discord_user_id: discordId,
        actualizado_en: new Date().toISOString()
      };

      if (codeforcesInput) {
        updateData.codeforces_handle = codeforcesInput;
      }

      const { error: errorUpdate } = await supabase
        .from('estudiantes')
        .update(updateData)
        .eq('id', estudiante.id);

      if (errorUpdate) {
        console.error('Detalle error vinculación:', errorUpdate);
        return interaction.editReply(`❌ Error al actualizar en Supabase: \`${errorUpdate.message}\``);
      }

      const tracks = [];
      if (estudiante.inscrito_cpc) tracks.push('💻 CPC');
      if (estudiante.inscrito_hub) tracks.push('💼 HUB');

      const embed = new EmbedBuilder()
        .setTitle('✅ Cuenta Vinculada Exitosamente')
        .setColor(0x00A86B)
        .setDescription(`¡Bienvenido(a), **${estudiante.nombre}**! Tu cuenta de Discord ha sido enlazada.`)
        .addFields(
          { name: '📧 Correo Institucional', value: `\`${estudiante.correo}\``, inline: true },
          { name: '🎯 Tracks Activos', value: tracks.join('\n') || '_Sin tracks asignados_', inline: true },
          { name: '🌐 Codeforces Handle', value: codeforcesInput ? `\`${codeforcesInput}\`` : (estudiante.codeforces_handle ? `\`${estudiante.codeforces_handle}\`` : '_No especificado_'), inline: false }
        )
        .setFooter({ text: 'Tracker' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Error en /vincular:', err);
      return interaction.editReply('❌ Ocurrió un error inesperado al vincular la cuenta.');
    }
  }

  // 2. /iniciar-sesion
  if (commandName === 'iniciar-sesion') {
    await interaction.deferReply();

    const sesionId = options.getInteger('sesion_id');
    const minutos = options.getInteger('minutos') || 15;

    try {
      const { data: sesion, error: errSesion } = await supabase
        .from('sesiones')
        .select('*')
        .eq('id', sesionId)
        .maybeSingle();

      if (errSesion || !sesion) {
        return interaction.editReply(`❌ No se encontró ninguna sesión con el ID \`${sesionId}\`.`);
      }

      const codigo = generarCodigoOTP(6);
      const fechaExpiracion = new Date(Date.now() + minutos * 60 * 1000);

      const { error: errUpdate } = await supabase
        .from('sesiones')
        .update({
          codigo_asistencia: codigo,
          codigo_expira_en: fechaExpiracion.toISOString(),
          activa: true
        })
        .eq('id', sesion.id);

      if (errUpdate) {
        return interaction.editReply('❌ Error al actualizar el código de asistencia en Supabase.');
      }

      const embed = new EmbedBuilder()
        .setTitle(`📢 Asistencia Abierta: ${sesion.nombre}`)
        .setColor(0x3498DB)
        .setDescription(
          `Se ha habilitado el registro de asistencia para la sesión de hoy.\n\n` +
          `🔑 **Código de Registro:** \`${codigo}\`\n` +
          `⏳ **Válido durante:** \`${minutos} minutos\` (Expira <t:${Math.floor(fechaExpiracion.getTime() / 1000)}:R>)\n\n` +
          `Para registrar tu asistencia escribe en el chat:\n` +
          `**\`/asistencia codigo:${codigo}\`**`
        )
        .addFields(
          { name: '📚 Programa', value: `${sesion.programa}`, inline: true },
          { name: '🏷️ Módulo', value: `${sesion.modulo}`, inline: true },
          { name: '🆔 ID de Sesión', value: `\`${sesion.id}\``, inline: true }
        )
        .setFooter({ text: 'Attendance System' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Error en /iniciar-sesion:', err);
      return interaction.editReply('❌ Ocurrió un error inesperado al abrir la sesión.');
    }
  }

  // 3. /asistencia
  if (commandName === 'asistencia') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const codigoIngresado = options.getString('codigo').trim().toUpperCase();
    const discordId = interaction.user.id;

    try {
      const { data: estudiante, error: errEstudiante } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('discord_user_id', discordId)
        .maybeSingle();

      if (errEstudiante || !estudiante) {
        return interaction.editReply(
          '❌ Tu cuenta de Discord no está vinculada. Por favor ejecuta primero:\n' +
          '`/vincular correo:tu_correo@alumnos.uady.mx`'
        );
      }

      const { data: sesion, error: errSesion } = await supabase
        .from('sesiones')
        .select('*')
        .eq('codigo_asistencia', codigoIngresado)
        .eq('activa', true)
        .maybeSingle();

      if (errSesion || !sesion) {
        return interaction.editReply('❌ Código de asistencia inválido o no pertenece a una sesión activa.');
      }

      const ahora = new Date();
      const expiraEn = new Date(sesion.codigo_expira_en);

      if (ahora > expiraEn) {
        return interaction.editReply('❌ El código de asistencia ha expirado.');
      }

      if (sesion.programa === 'CPC' && !estudiante.inscrito_cpc) {
        return interaction.editReply('⚠️ No estás registrado(a) en el track de CPC.');
      }
      if (sesion.programa === 'HUB' && !estudiante.inscrito_hub) {
        return interaction.editReply('⚠️ No estás registrado(a) en el track de HUB.');
      }

      const { data: registroExistente } = await supabase
        .from('registro_sesion')
        .select('*')
        .eq('sesion_id', sesion.id)
        .eq('estudiante_id', estudiante.id)
        .maybeSingle();

      if (registroExistente && registroExistente.asistencia === 'PRESENTE') {
        return interaction.editReply('ℹ️ Ya habías registrado tu asistencia para esta sesión.');
      }

      const { error: errUpsert } = await supabase
        .from('registro_sesion')
        .upsert(
          {
            sesion_id: sesion.id,
            estudiante_id: estudiante.id,
            asistencia: 'PRESENTE',
            registrado_en: ahora.toISOString()
          },
          { onConflict: 'sesion_id,estudiante_id' }
        );

      if (errUpsert) {
        return interaction.editReply('❌ Error al registrar tu asistencia en la base de datos.');
      }

      return interaction.editReply(
        `✅ **¡Asistencia registrada con éxito!**\n` +
        `• **Estudiante:** ${estudiante.nombre}\n` +
        `• **Sesión:** ${sesion.nombre} (${sesion.programa} - ${sesion.modulo})\n` +
        `• **Fecha/Hora:** ${ahora.toLocaleTimeString()}`
      );

    } catch (err) {
      console.error('Error en /asistencia:', err);
      return interaction.editReply('❌ Ocurrió un error inesperado al procesar la asistencia.');
    }
  }

  // 4. /mi-progreso
  if (commandName === 'mi-progreso') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const discordId = interaction.user.id;

    try {
      const { data: estudiante, error: errEst } = await supabase
        .from('estudiantes')
        .select('*')
        .eq('discord_user_id', discordId)
        .maybeSingle();

      if (errEst || !estudiante) {
        return interaction.editReply(
          '❌ Tu cuenta no está vinculada. Usa `/vincular correo:tu_correo@institucion.edu` para comenzar.'
        );
      }

      const { data: sesiones, error: errSes } = await supabase
        .from('sesiones')
        .select('id, nombre, programa, fecha');

      const { data: registros, error: errReg } = await supabase
        .from('registro_sesion')
        .select('sesion_id, asistencia, puntaje_actividad, feedback')
        .eq('estudiante_id', estudiante.id);

      if (errSes || errReg) {
        return interaction.editReply('❌ Error al consultar tus estadísticas.');
      }

      const mapaRegistros = new Map();
      let puntajeTotal = 0;
      const feedbacksRecientes = [];

      registros.forEach(r => {
        mapaRegistros.set(r.sesion_id, r);
        if (r.puntaje_actividad) puntajeTotal += parseFloat(r.puntaje_actividad);
        if (r.feedback) feedbacksRecientes.push(r.feedback);
      });

      const sesionesCPC = sesiones.filter(s => s.programa === 'CPC');
      const asistidasCPC = sesionesCPC.filter(s => {
        const reg = mapaRegistros.get(s.id);
        return reg && (reg.asistencia === 'PRESENTE' || reg.asistencia === 'JUSTIFICADO');
      }).length;

      const pctCPC = sesionesCPC.length > 0 ? ((asistidasCPC / sesionesCPC.length) * 100).toFixed(0) : 'N/A';

      const sesionesHUB = sesiones.filter(s => s.programa === 'HUB');
      const asistidasHUB = sesionesHUB.filter(s => {
        const reg = mapaRegistros.get(s.id);
        return reg && (reg.asistencia === 'PRESENTE' || reg.asistencia === 'JUSTIFICADO');
      }).length;

      const pctHUB = sesionesHUB.length > 0 ? ((asistidasHUB / sesionesHUB.length) * 100).toFixed(0) : 'N/A';

      const elegible = (pctCPC !== 'N/A' && parseFloat(pctCPC) >= 80) || (pctHUB !== 'N/A' && parseFloat(pctHUB) >= 80);

      const embed = new EmbedBuilder()
        .setTitle(`📊 Progreso General: ${estudiante.nombre}`)
        .setColor(elegible ? 0x00A86B : 0xE67E22)
        .setDescription(
          `**Correo:** \`${estudiante.correo}\`\n` +
          `**Codeforces:** \`${estudiante.codeforces_handle || 'No vinculado'}\`\n` +
          `**Puntaje Total Acumulado:** \`${puntajeTotal.toFixed(1)} pts\`\n\n` +
          `**Elegibilidad Industry Mock (Req: 80%):** ${elegible ? '✅ **ELEGIBLE**' : '⏳ **EN PROGRESO**'}`
        )
        .addFields(
          {
            name: '💻 Track CPC',
            value: `Asistencia: **${asistidasCPC}/${sesionesCPC.length}** (\`${pctCPC}%\`)`,
            inline: true
          },
          {
            name: '💼 Track HUB',
            value: `Asistencia: **${asistidasHUB}/${sesionesHUB.length}** (\`${pctHUB}%\`)`,
            inline: true
          }
        )
        .setFooter({ text: 'Tracker' })
        .setTimestamp();

      if (feedbacksRecientes.length > 0) {
        embed.addFields({
          name: '💬 Último Feedback de Mentores',
          value: feedbacksRecientes.slice(-3).map(f => `• ${f}`).join('\n'),
          inline: false
        });
      }

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Error en /mi-progreso:', err);
      return interaction.editReply('❌ Error inesperado al cargar tu progreso.');
    }
  }

  // 5. /leaderboard
  if (commandName === 'leaderboard') {
    await interaction.deferReply();

    const filtroPrograma = options.getString('programa') || 'GENERAL';

    try {
      let queryEstudiantes = supabase
        .from('estudiantes')
        .select('id, nombre, codeforces_handle, inscrito_cpc, inscrito_hub')
        .eq('status', 'ACTIVO');

      if (filtroPrograma === 'CPC') queryEstudiantes = queryEstudiantes.eq('inscrito_cpc', true);
      if (filtroPrograma === 'HUB') queryEstudiantes = queryEstudiantes.eq('inscrito_hub', true);

      const { data: estudiantes, error: errEst } = await queryEstudiantes;
      const { data: registros, error: errReg } = await supabase
        .from('registro_sesion')
        .select('estudiante_id, puntaje_actividad, asistencia');

      if (errEst || errReg) {
        return interaction.editReply('❌ Error al consultar los datos del ranking.');
      }

      const statsPorEstudiante = new Map();

      estudiantes.forEach(est => {
        statsPorEstudiante.set(est.id, {
          nombre: est.nombre,
          handle: est.codeforces_handle || null,
          puntos: 0,
          asistencias: 0
        });
      });

      registros.forEach(r => {
        if (statsPorEstudiante.has(r.estudiante_id)) {
          const actual = statsPorEstudiante.get(r.estudiante_id);
          if (r.puntaje_actividad) actual.puntos += parseFloat(r.puntaje_actividad);
          if (r.asistencia === 'PRESENTE' || r.asistencia === 'JUSTIFICADO') actual.asistencias += 1;
        }
      });

      const ranking = Array.from(statsPorEstudiante.values())
        .sort((a, b) => b.puntos - a.puntos || b.asistencias - a.asistencias)
        .slice(0, 10);

      const medallas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

      const lista = ranking.map((item, index) => {
        const handleStr = item.handle ? `(\`@${item.handle}\`)` : '';
        return `${medallas[index]} **${item.nombre}** ${handleStr}\n┗ 🏆 **${item.puntos.toFixed(1)} pts** • 📅 ${item.asistencias} asistencias`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Leaderboard Oficial - Track ${filtroPrograma}`)
        .setColor(0xF1C40F)
        .setDescription(ranking.length > 0 ? lista : '_No hay actividad registrada en este track aún._')
        .setFooter({ text: 'Leaderboard • Top 10' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Error en /leaderboard:', err);
      return interaction.editReply('❌ Error inesperado al generar el leaderboard.');
    }
  }

  // 6. /calificar-mock
  if (commandName === 'calificar-mock') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const correoInput = options.getString('correo').trim().toLowerCase();
    const sesionId = options.getInteger('sesion_id');
    const puntaje = options.getNumber('puntaje');
    const feedback = options.getString('feedback').trim();

    try {
      const { data: estudiante, error: errEst } = await supabase
        .from('estudiantes')
        .select('id, nombre, correo')
        .ilike('correo', correoInput)
        .maybeSingle();

      if (errEst || !estudiante) {
        return interaction.editReply(`❌ No se encontró ningún estudiante con el correo \`${correoInput}\`.`);
      }

      const { data: sesion, error: errSes } = await supabase
        .from('sesiones')
        .select('id, nombre, programa')
        .eq('id', sesionId)
        .maybeSingle();

      if (errSes || !sesion) {
        return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
      }

      const { data: regPrevio } = await supabase
        .from('registro_sesion')
        .select('asistencia')
        .eq('sesion_id', sesion.id)
        .eq('estudiante_id', estudiante.id)
        .maybeSingle();

      const estadoAsistencia = regPrevio?.asistencia || 'PRESENTE';

      const { error: upsertError } = await supabase
        .from('registro_sesion')
        .upsert(
          {
            sesion_id: sesion.id,
            estudiante_id: estudiante.id,
            asistencia: estadoAsistencia,
            puntaje_actividad: puntaje,
            feedback: `Mock Interview: ${feedback}`,
            registrado_en: new Date().toISOString()
          },
          { onConflict: 'sesion_id,estudiante_id' }
        );

      if (upsertError) {
        return interaction.editReply(`❌ Error al guardar la calificación: ${upsertError.message}`);
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Mock Interview Calificada')
        .setColor(0x00A86B)
        .setDescription(`Se ha registrado la retroalimentación de la entrevista con éxito.`)
        .addFields(
          { name: '👤 Estudiante', value: `${estudiante.nombre} (\`${estudiante.correo}\`)`, inline: false },
          { name: '🎯 Sesión', value: `${sesion.nombre}`, inline: true },
          { name: '⭐ Puntaje', value: `\`${puntaje.toFixed(1)} / 100\``, inline: true },
          { name: '📝 Feedback', value: `${feedback}`, inline: false }
        )
        .setFooter({ text: 'HUB Mock Interview Tracker' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Error en /calificar-mock:', err);
      return interaction.editReply('❌ Error inesperado al calificar la mock interview.');
    }
  }

  // 7. /calificar-concurso
  if (commandName === 'calificar-concurso') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const correoInput = options.getString('correo').trim().toLowerCase();
    const sesionId = options.getInteger('sesion_id');
    const puntaje = options.getNumber('puntaje');
    const feedback = options.getString('feedback')?.trim() || null;

    try {
      const { data: estudiante, error: errEst } = await supabase
        .from('estudiantes')
        .select('id, nombre, correo')
        .ilike('correo', correoInput)
        .maybeSingle();

      if (errEst || !estudiante) {
        return interaction.editReply(`❌ No se encontró ningún estudiante con el correo \`${correoInput}\`.`);
      }

      const { data: sesion, error: errSes } = await supabase
        .from('sesiones')
        .select('id, nombre, programa')
        .eq('id', sesionId)
        .maybeSingle();

      if (errSes || !sesion) {
        return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
      }

      const { data: regPrevio } = await supabase
        .from('registro_sesion')
        .select('asistencia')
        .eq('sesion_id', sesion.id)
        .eq('estudiante_id', estudiante.id)
        .maybeSingle();

      const estadoAsistencia = regPrevio?.asistencia || 'PRESENTE';

      const { error: upsertError } = await supabase
        .from('registro_sesion')
        .upsert(
          {
            sesion_id: sesion.id,
            estudiante_id: estudiante.id,
            asistencia: estadoAsistencia,
            puntaje_actividad: puntaje,
            feedback: feedback || `Concurso: ${puntaje} pts registrados manualmente`,
            registrado_en: new Date().toISOString()
          },
          { onConflict: 'sesion_id,estudiante_id' }
        );

      if (upsertError) {
        return interaction.editReply(`❌ Error al guardar el puntaje: ${upsertError.message}`);
      }

      return interaction.editReply(
        `✅ **Puntaje de Concurso Registrado**\n` +
        `• **Estudiante:** ${estudiante.nombre} (\`${estudiante.correo}\`)\n` +
        `• **Sesión:** ${sesion.nombre}\n` +
        `• **Puntaje:** \`${puntaje.toFixed(1)} pts\`\n` +
        (feedback ? `• **Feedback:** ${feedback}` : '')
      );

    } catch (err) {
      console.error('Error en /calificar-concurso:', err);
      return interaction.editReply('❌ Error inesperado al registrar calificación.');
    }
  }

  // 8. /resumen-sesion
  if (commandName === 'resumen-sesion') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sesionId = options.getInteger('sesion_id');

    try {
      const { data: sesion, error: errSes } = await supabase
        .from('sesiones')
        .select('id, nombre, programa, modulo, activa, codigo_asistencia, codigo_expira_en')
        .eq('id', sesionId)
        .maybeSingle();

      if (errSes || !sesion) {
        return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
      }

      let queryEst = supabase.from('estudiantes').select('id, nombre, correo').eq('status', 'ACTIVO');
      if (sesion.programa === 'CPC') queryEst = queryEst.eq('inscrito_cpc', true);
      if (sesion.programa === 'HUB') queryEst = queryEst.eq('inscrito_hub', true);

      const { data: estudiantesEsperados, error: errEst } = await queryEst;
      if (errEst) {
        return interaction.editReply('❌ Error al consultar estudiantes del track.');
      }

      const { data: registros, error: errReg } = await supabase
        .from('registro_sesion')
        .select('estudiante_id, asistencia, puntaje_actividad, feedback')
        .eq('sesion_id', sesion.id);

      if (errReg) {
        return interaction.editReply('❌ Error al consultar registros de la sesión.');
      }

      const mapaRegistros = new Map();
      registros.forEach(r => mapaRegistros.set(r.estudiante_id, r));

      const presentes = [];
      const justificados = [];
      const ausentes = [];

      estudiantesEsperados.forEach(est => {
        const reg = mapaRegistros.get(est.id);
        if (!reg || reg.asistencia === 'AUSENTE') {
          ausentes.push(`• ${est.nombre}`);
        } else if (reg.asistencia === 'JUSTIFICADO') {
          justificados.push(`• ${est.nombre} *(Justificado)*`);
        } else {
          presentes.push(`• ${est.nombre}`);
        }
      });

      const totalEsperados = estudiantesEsperados.length;
      const totalAsistieron = presentes.length + justificados.length;
      const quorumPct = totalEsperados > 0 ? ((totalAsistieron / totalEsperados) * 100).toFixed(0) : '0';

      const embed = new EmbedBuilder()
        .setTitle(`📋 Resumen de Sesión: ${sesion.nombre}`)
        .setColor(sesion.activa ? 0x00A86B : 0x34495E)
        .setDescription(
          `**Programa:** ${sesion.programa} | **Módulo:** ${sesion.modulo}\n` +
          `**Estado:** ${sesion.activa ? '🟢 Sesión Abierta' : '⚪ Sesión Cerrada'}\n` +
          `**Quórum:** **${totalAsistieron}/${totalEsperados}** (\`${quorumPct}%\`)\n` +
          (sesion.codigo_asistencia ? `**Código OTP:** \`${sesion.codigo_asistencia}\`\n` : '')
        )
        .addFields(
          {
            name: `✅ Presentes (${presentes.length})`,
            value: presentes.length > 0 ? presentes.slice(0, 15).join('\n') : '_Nadie ha registrado asistencia_',
            inline: true
          },
          {
            name: `❌ Ausentes (${ausentes.length})`,
            value: ausentes.length > 0 ? ausentes.slice(0, 15).join('\n') : '_Todos presentes_',
            inline: true
          }
        )
        .setFooter({ text: 'Tracker • Monitoreo' })
        .setTimestamp();

      if (justificados.length > 0) {
        embed.addFields({
          name: `⚠️ Justificados (${justificados.length})`,
          value: justificados.join('\n'),
          inline: false
        });
      }

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Error en /resumen-sesion:', err);
      return interaction.editReply('❌ Error inesperado al generar el resumen de sesión.');
    }
  }

  // 9. /justificar-falta
  if (commandName === 'justificar-falta') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const correoInput = options.getString('correo').trim().toLowerCase();
    const sesionId = options.getInteger('sesion_id');
    const motivo = options.getString('motivo').trim();

    try {
      const { data: estudiante, error: errEst } = await supabase
        .from('estudiantes')
        .select('id, nombre, correo')
        .ilike('correo', correoInput)
        .maybeSingle();

      if (errEst || !estudiante) {
        return interaction.editReply(`❌ No se encontró ningún estudiante con el correo \`${correoInput}\`.`);
      }

      const { data: sesion, error: errSes } = await supabase
        .from('sesiones')
        .select('id, nombre, programa')
        .eq('id', sesionId)
        .maybeSingle();

      if (errSes || !sesion) {
        return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
      }

      const { error: upsertError } = await supabase
        .from('registro_sesion')
        .upsert(
          {
            sesion_id: sesion.id,
            estudiante_id: estudiante.id,
            asistencia: 'JUSTIFICADO',
            feedback: `Falta justificada: ${motivo}`,
            registrado_en: new Date().toISOString()
          },
          { onConflict: 'sesion_id,estudiante_id' }
        );

      if (upsertError) {
        return interaction.editReply(`❌ Error al guardar justificación: ${upsertError.message}`);
      }

      return interaction.editReply(
        `✅ **Falta Justificada con Éxito**\n` +
        `• **Estudiante:** ${estudiante.nombre} (\`${estudiante.correo}\`)\n` +
        `• **Sesión:** ${sesion.nombre} (${sesion.programa})\n` +
        `• **Motivo:** "${motivo}"\n` +
        `*(Esta sesión ahora cuenta positivamente para su porcentaje de asistencia)*`
      );

    } catch (err) {
      console.error('Error en /justificar-falta:', err);
      return interaction.editReply('❌ Error inesperado al procesar la justificación.');
    }
  }

  // ==========================================
  // 10. /sincronizar-codeforces 
  // ==========================================
  if (commandName === 'sincronizar-codeforces') {
    // 1. Avisar inmediatamente a Discord que estamos trabajando (evita el timeout de 3s)
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sesionId = options.getInteger('sesion_id');
    const contestId = options.getInteger('contest_id');
    const problemasInput = options.getString('problemas');
    const puntosPorProblema = options.getNumber('puntos_por_problema') || 10.0;

    if (!contestId && !problemasInput) {
      return interaction.editReply('❌ Debes ingresar al menos un `contest_id` o una lista de `problemas` (ej. `106540G, 106540A`).');
    }

    try {
      // 2. Validar sesión
      const { data: sesion, error: errSes } = await supabase
        .from('sesiones')
        .select('id, nombre, programa')
        .eq('id', sesionId)
        .maybeSingle();

      if (errSes || !sesion) {
        return interaction.editReply(`❌ No se encontró la sesión con ID \`${sesionId}\`.`);
      }

      // 3. Obtener estudiantes activos con handle
      const { data: estudiantes, error: errEst } = await supabase
        .from('estudiantes')
        .select('id, nombre, codeforces_handle')
        .not('codeforces_handle', 'is', null)
        .eq('status', 'ACTIVO');

      if (errEst || !estudiantes || estudiantes.length === 0) {
        return interaction.editReply('⚠️ No hay estudiantes con handle de Codeforces activo en la base de datos.');
      }

      // 4. Procesar lista de problemas buscados
      const codigosBuscados = new Set();
      if (problemasInput) {
        problemasInput.split(',').forEach(p => {
          const limpio = p.trim().toUpperCase().replace(/\s+/g, '');
          if (limpio) codigosBuscados.add(limpio);
        });
      }

      const actualizados = [];

      // 5. Consultar API de Codeforces por cada estudiante
      for (const est of estudiantes) {
        const handle = est.codeforces_handle.trim();
        try {
          const res = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=100`);
          const data = await res.json();

          if (data.status === 'OK' && Array.isArray(data.result)) {
            const problemasAprobados = new Set();

            for (const sub of data.result) {
              if (sub.verdict !== 'OK') continue;

              const cId = sub.contestId || sub.problem?.contestId;
              const idx = (sub.problem?.index || '').toUpperCase();
              const fullCode = `${cId}${idx}`; // ej: 106540G

              // Coincidencia por contestId completo
              if (contestId && cId === contestId) {
                problemasAprobados.add(fullCode || idx);
              }
              // Coincidencia por código de problema específico
              else if (codigosBuscados.has(fullCode) || codigosBuscados.has(idx)) {
                problemasAprobados.add(fullCode);
              }
            }

            const totalAC = problemasAprobados.size;

            if (totalAC > 0) {
              const puntajeTotal = totalAC * puntosPorProblema;
              const listaNombres = Array.from(problemasAprobados).join(', ');

              const { data: regPrevio } = await supabase
                .from('registro_sesion')
                .select('asistencia')
                .eq('sesion_id', sesion.id)
                .eq('estudiante_id', est.id)
                .maybeSingle();

              const estadoAsistencia = regPrevio?.asistencia || 'PRESENTE';

              await supabase
                .from('registro_sesion')
                .upsert(
                  {
                    sesion_id: sesion.id,
                    estudiante_id: est.id,
                    asistencia: estadoAsistencia,
                    puntaje_actividad: puntajeTotal,
                    feedback: `Práctica CF: ${totalAC} AC (${listaNombres})`,
                    registrado_en: new Date().toISOString()
                  },
                  { onConflict: 'sesion_id,estudiante_id' }
                );

              actualizados.push({
                nombre: est.nombre,
                handle: handle,
                ac: totalAC,
                problemas: listaNombres,
                puntos: puntajeTotal
              });
            }
          }
        } catch (subErr) {
          console.error(`Error consultando handle ${handle}:`, subErr);
        }

        // Pequeño delay de cortesía para la API de CF
        await new Promise(r => setTimeout(r, 200));
      }

      if (actualizados.length === 0) {
        return interaction.editReply(
          `⚠️ No se encontraron envíos con veredicto \`OK\` para los criterios indicados entre los estudiantes registrados.`
        );
      }

      const lista = actualizados.map(
        a => `• **${a.nombre}** (\`@${a.handle}\`) ➔ **${a.ac} AC** [${a.problemas}] (\`${a.puntos.toFixed(1)} pts\`)`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('⚡ Sincronización de Codeforces Exitosa')
        .setColor(0x00A86B)
        .setDescription(
          `**Sesión:** ${sesion.nombre} (ID: \`${sesion.id}\`)\n` +
          `**Criterio:** ${contestId ? `Contest \`#${contestId}\`` : ''} ${problemasInput ? `Problemas: \`${problemasInput}\`` : ''}\n` +
          `**Puntaje:** \`${puntosPorProblema} pts por problema resuelto\`\n\n` +
          `**Alumnos Evaluados (${actualizados.length}):**\n${lista}`
        )
        .setFooter({ text: 'Codeforces Submissions Sync' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error('Error en /sincronizar-codeforces:', err);
      return interaction.editReply('❌ Ocurrió un error inesperado al sincronizar con Codeforces.');
    }
  }

  // 11. /importar-standings (Modal)
  if (commandName === 'importar-standings') {
    const sesionId = options.getInteger('sesion_id');
    const puntos = options.getNumber('puntos_por_problema') || 20.0;

    const modal = new ModalBuilder()
      .setCustomId(`modal_standings_${sesionId}_${puntos}`)
      .setTitle(`Importar Standings (Sesión #${sesionId})`);

    const inputTexto = new TextInputBuilder()
      .setCustomId('standings_raw_text')
      .setLabel('Pega aquí las filas de la tabla de Standings')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('1   Maricharmen   1   0   +\nMaricharmen 1\nJuanPerez 3')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(inputTexto));
    await interaction.showModal(modal);
  }
});

// ==========================================
// 3. CONEXIÓN A DISCORD
// ==========================================
client.login(process.env.DISCORD_TOKEN);