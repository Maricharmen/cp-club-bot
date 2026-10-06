# 🤖 CP Club Bot 

Bot oficial para la gestión automatizada de asistencias, seguimiento de progreso académico, evaluaciones técnicas y rankings de **CPC** y **HUB**.

---

## 🛠️ Guía Rápida para Administradores y Mentores

Los comandos administrativos requieren permisos de administración o gestión de canales según el comando. El bot debe tener los permisos indicados en la sección de configuración.

| Comando | Descripción | Ejemplo de Uso |
| :--- | :--- | :--- |
| `/iniciar-sesion` | Genera un código OTP de 6 caracteres con tiempo límite para check-in. | `/iniciar-sesion sesion_id:1 minutos:15` |
| `/resumen-sesion` | Muestra en tiempo real la lista de presentes, ausentes y el porcentaje de quórum. | `/resumen-sesion sesion_id:1` |
| `/importar-standings` | Abre un modal para pegar el texto de la tabla de posiciones de Codeforces (Mashup o Grupo) y calificar en lote. | `/importar-standings sesion_id:1 puntos_por_problema:20` |
| `/sincronizar-codeforces` | Consulta la API pública de Codeforces para calificar problemas específicos o concursos del Gym. | `/sincronizar-codeforces sesion_id:1 contest_id:106540 puntos_por_problema:10` |
| `/calificar-mock` | Asigna puntaje numérico (0-100) y retroalimentación técnica de una Mock Interview. | `/calificar-mock correo:alumno@uady.mx sesion_id:2 puntaje:85 feedback:Buen manejo de DP` |
| `/calificar-concurso` | Registra manualmente una calificación individual extemporánea. | `/calificar-concurso correo:alumno@uady.mx sesion_id:1 puntaje:60` |
| `/justificar-falta` | Registra una ausencia justificada para que compute a favor del porcentaje de asistencia. | `/justificar-falta correo:alumno@uady.mx sesion_id:1 motivo:Cruce de horario académico` |
| `/crear-canal-voz` | Crea un canal principal que genera canales personales automáticamente. | `/crear-canal-voz nombre:Sala CPC categoria_id:123456789012345678` |
| `/configurar-logs-voz` | Selecciona el canal de texto donde se registran los eventos de voz. | `/configurar-logs-voz canal:#logs-voz` |
| `/crear-equipo` | Abre una interfaz para crear un rol de equipo con nombre, color y hasta 3 compañeros. | `/crear-equipo` |
| `/gestionar-equipo` | Abre una interfaz para reemplazar los compañeros de tu equipo. | `/gestionar-equipo` |
| `/salir-equipo` | Retira tu usuario de un equipo sin eliminarlo. | `/salir-equipo` |
| `/salir-equipo` | Retira tu usuario de un equipo sin eliminarlo. | `/salir-equipo` |
| `/help` | Abre una guía navegable por secciones con todos los comandos del bot. | `/help` |
| `/listar-equipos` | Muestra todos los equipos del servidor, sus propietarios y miembros actuales. | `/listar-equipos` |

### 🎂 Cumpleaños

Cada persona puede registrar o actualizar su cumpleaños con `/cumpleanos mes:MM dia:DD`. Un administrador puede elegir el canal de avisos con `/configurar-canal-cumpleanos canal:#cumpleanos`. El bot publica una lista del mes y un recordatorio el día correspondiente; también puedes consultar un mes con `/listar-cumpleanos mes:MM`.

Los cumpleaños y el canal se guardan en `data/birthdays.json`. El bot usa `America/Merida` como zona horaria por defecto; puedes cambiarla con la variable `BIRTHDAY_TIMEZONE`.
| `/eliminar-equipo` | Elimina un equipo y su rol asociado. | `/eliminar-equipo equipo:@NombreDelEquipo` |

### 📋 Flujo de Trabajo Semanal Recomendado

1. **Al iniciar la clase/taller:** Ejecuta `/iniciar-sesion sesion_id:X minutos:15`. Comparte el código generado con los asistentes.
2. **Durante la clase:** Monitorea los check-ins con `/resumen-sesion sesion_id:X`.
3. **Al finalizar un contest en Grupo Privado:** Abre la tabla de *Standings* en Codeforces, copia las filas (`Ctrl + C`), ejecuta `/importar-standings sesion_id:X` y pega el contenido en la ventana emergente.

---

## 🎓 Guía para Alumnos y Participantes

Comandos públicos disponibles para todos los miembros registrados en el club.

| Comando | Descripción | Cuándo Usarlo |
| :--- | :--- | :--- |
| `/vincular` | Enlaza tu cuenta de Discord con tu correo institucional y tu handle de Codeforces. | **Paso obligatorio inicial** antes de usar cualquier otra función del bot. |
| `/asistencia` | Registra tu asistencia a la clase activa introduciendo el código OTP de 6 caracteres. | Durante los primeros minutos de cada sesión cuando el mentor proyecte el código. |
| `/mi-progreso` | Muestra tu porcentaje de asistencia en CPC y HUB, puntos acumulados, feedback de mentores y estatus de elegibilidad para la **Industry Mock**. | En cualquier momento para auditar tu rendimiento. |
| `/leaderboard` | Despliega la tabla de clasificación Top 10 general o filtrada por track (`CPC` o `HUB`). | Para consultar el ranking competitivo semanal. |

## 🔊 Canales de Voz Dinámicos

Los administradores pueden crear tantos canales principales como necesiten, incluso en categorías diferentes. Para crear uno, activa el **Modo desarrollador** de Discord, copia el ID de la categoría y ejecuta:

`/crear-canal-voz nombre:Sala CPC categoria_id:ID_DE_LA_CATEGORIA`

Cada persona que entre a un canal principal recibirá su propio canal de voz dentro de la misma categoría. El canal se elimina automáticamente cuando queda vacío. El propietario puede cambiarlo desde los permisos de Discord o usando:

`/configurar-mi-canal-voz nombre:Mi sala limite:5`

El bot guarda los IDs de los canales principales, dinámicos y de logs en `data/voice-channels.json` para recuperarlos después de reiniciarse. No edites este archivo mientras el bot esté funcionando.

Para configurar el canal de auditoría de voz, un administrador debe ejecutar:

`/configurar-logs-voz canal:#logs-voz`

El bot registrará la creación de canales principales, las entradas y salidas de usuarios, la creación de canales personales y su cierre automático. El comando requiere el permiso `Manage Server`.

## 👥 Equipos

Un usuario puede crear un solo equipo con `/crear-equipo`. El bot pedirá el nombre y un color hexadecimal (por ejemplo, `#F4511E`) y después mostrará un selector para elegir hasta 3 compañeros; el creador siempre forma parte del equipo. El rol se asigna automáticamente a las cuatro personas seleccionadas como máximo.

Para cambiar integrantes, usa `/gestionar-equipo`, selecciona los compañeros que deben conservar el rol y pulsa **Guardar miembros**. Seleccionar cero compañeros deja únicamente al creador, por lo que también sirve para retirar integrantes. Un miembro que no sea el propietario puede usar `/salir-equipo` para retirarse sin afectar al resto. El rol se borra automáticamente si queda sin miembros, y sus datos se guardan en `data/team-roles.json`.

Para consultar todos los equipos del servidor, usa `/listar-equipos`. El propietario puede eliminar su propio equipo con `/eliminar-equipo` sin indicar el rol; un administrador con permiso `Manage Server` puede indicar el rol del equipo para eliminar cualquiera. Al eliminarlo, el bot borra el rol de Discord y su registro persistido.

---

## ⚙️ Arquitectura Técnica y Configuración

### Requisitos Previos
* **Node.js** v18 o superior.
* Base de datos PostgreSQL en **Supabase**.
* Aplicación y Bot configurados en el **Discord Developer Portal**.

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto, junto a `index.js`:

```env
DISCORD_TOKEN=token_del_bot
CLIENT_ID=id_de_la_aplicacion
GUILD_ID=id_del_servidor
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-anon-public-key
BIRTHDAY_TIMEZONE=America/Merida
```

Puedes obtener la URL y la key desde Supabase en `Project Settings > Data API`. Usa una base de datos de pruebas si no quieres modificar datos reales. Nunca publiques `.env` ni compartas sus valores.

### Permisos del Bot en Discord

Al invitar el bot, selecciona los scopes `bot` y `applications.commands`. Para los canales de voz dinámicos necesita:

* `View Channels`
* `Send Messages`
* `Embed Links`
* `Manage Channels`
* `Move Members`
* `Connect`
* `Speak`

El bot también necesita acceso al canal de texto configurado para los logs.

Para `/crear-equipo`, el bot necesita el permiso `Manage Roles` y su rol debe estar por encima de los roles de equipo en la jerarquía del servidor.

## Inicialización y Despliegue

1. Instalar dependencias:

   `npm install`

2. Desplegar o actualizar los slash commands:

   `node deploy-commands.js`

3. Iniciar el bot:

   `node index.js`

La terminal debe permanecer abierta. Para probar cambios antes de subirlos a GitHub, usa un segundo bot de Discord y, preferiblemente, un servidor y proyecto de Supabase de pruebas. No conectes localmente el mismo token que ya está conectado en producción.

### Plan de Prueba Inmediato en Discord

Para probar los canales de voz dinámicos:

1. Inicia el bot con `node index.js`.
2. Crea un canal de texto llamado `logs-voz`.
3. Ejecuta `/configurar-logs-voz` y selecciona `#logs-voz`.
4. Copia el ID de una categoría y ejecuta `/crear-canal-voz` con el nombre y `categoria_id`.
5. Entra al canal principal. Debe crearse un canal personal y Discord debe moverte automáticamente a él.
6. Ejecuta `/configurar-mi-canal-voz nombre:Mi sala limite:5` dentro del canal personal.
7. Sal del canal. Al quedar vacío, debe eliminarse y aparecer un log de cierre.
8. Repite `/crear-canal-voz` usando otra categoría para verificar que pueden existir varios canales principales.

Los eventos de entrada, salida, creación y eliminación se publican en `#logs-voz`. Si no ocurre nada, verifica que el bot tenga `Manage Channels`, `Move Members` y el intent de estados de voz habilitado en el código.

Para probar el resto del bot, ejecuta estas pruebas en orden:

1. **Prueba de Vinculación:**  
   Escribe `/vincular correo:tu_correo@institucion.edu codeforces:Maricharmen`.  
   *Debe responderte con un mensaje efímero confirmando tu vinculación.*

2. **Prueba de Asistencia OTP:**  
   * Ejecuta `/iniciar-sesion sesion_id:1 minutos:15`.  
   * Copia el código de 6 caracteres recibido y escribe `/asistencia codigo:CODIGO`.

3. **Prueba de Calificación por Modal:**  
   * Ejecuta `/importar-standings sesion_id:1 puntos_por_problema:20`.  
   * En el modal pega `Maricharmen 2` o `1  Maricharmen  2  0  +  +` y envía.

4. **Prueba de Auditoría y Ranking:**  
   * Escribe `/mi-progreso` para verificar que tus 40 puntos y asistencia aparezcan reflejados.  
   * Escribe `/leaderboard programa:CPC` para confirmar tu posición en el Top 10.