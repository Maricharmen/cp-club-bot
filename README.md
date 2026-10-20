# 🤖 CP Club Bot

Bot de Discord del CP Club para **CPC** y **HUB**. Gestiona la asistencia con códigos temporales, la vinculación con Codeforces, las calificaciones de prácticas, integradores y mock interviews, los rangos por XP y el leaderboard, además de equipos, cumpleaños y canales de voz dinámicos.

---

## 🎓 Guía para Estudiantes

| Comando | Qué hace | Cuándo usarlo |
| :--- | :--- | :--- |
| `/vincular` | Enlaza tu cuenta de Discord con tu correo institucional y tu handle de Codeforces. | **Obligatorio antes de la primera clase.** |
| `/asistencia` | Registra tu asistencia con el código de 6 caracteres que da el mentor. | Al inicio de cada sesión, mientras el código siga vigente. |
| `/mi-progreso` | Muestra tu rango, XP, asistencia, historial por sesión, badges y último feedback. | En cualquier momento. |
| `/leaderboard` | Muestra la clasificación por rangos. | En cualquier momento. |
| `/help` | Abre una guía interactiva con los comandos disponibles para ti. | Cuando tengas dudas. |

### `/vincular`

`/vincular correo:tu_correo@alumnos.uady.mx codeforces:TuHandle`

* El correo debe ser el institucional con el que te inscribiste.
* El handle de Codeforces es opcional, pero **sin él no recibes puntos** de prácticas ni de integradores, porque las calificaciones se buscan por handle.
* Si escribiste mal tu handle, vuelve a ejecutar el comando con el mismo correo.
* Cada correo solo puede vincularse a una cuenta de Discord, y cada cuenta de Discord a un solo estudiante. Si el bot indica que el correo ya está vinculado a otra cuenta, contacta a un mentor.

### `/asistencia`

`/asistencia codigo:ABC234`

* El código vence a los 15 minutos, salvo que el mentor indique otra duración.
* No distingue mayúsculas ni minúsculas.
* Solo puedes registrarte en sesiones de un track en el que estés inscrito (CPC o HUB).
* Las faltas justificadas las registra un mentor.

### `/mi-progreso`

Respuesta privada con:

* **Rango actual, XP total del ciclo** y barra de progreso hacia el siguiente rango.
* **Elegibilidad para la Industry Mock**: requiere al menos **80% de asistencia** en alguno de tus tracks. Solo cuentan las sesiones que ya ocurrieron.
* **Actividades completadas**: prácticas, integradores y mock interviews sobre el total del ciclo.
* **Historial por sesión** de cada track inscrito: ✅ presente, ⚠️ justificado, ❌ falta, más los puntos de cada sesión y la próxima sesión programada.
* **Badges de culminación** y último feedback recibido.

### `/leaderboard`

* `/leaderboard`: vista general con los 6 rangos, cuántos estudiantes hay en cada uno y los 3 primeros de cada rango.
* `/leaderboard rango:Solver`: lista completa del rango, 15 estudiantes por página.
* Solo aparecen estudiantes con más de 0 XP. Los empates comparten posición (#1, #2, #2, #4).

### Rangos y badges

El rango no se guarda en la base de datos: se calcula con el XP acumulado en el ciclo activo.

| Rango | XP |
| :--- | :--- |
| 🌱 Rookie | 1 – 999 |
| 🔵 Explorer | 1,000 – 1,999 |
| 🟣 Solver | 2,000 – 2,999 |
| 🟠 Challenger | 3,000 – 3,999 |
| 🔴 Competitor | 4,000 – 4,999 |
| 👑 Master | 5,000 – 5,900 |

| Badge | Requisito |
| :--- | :--- |
| 📝 Task Master | Completar todas las prácticas del ciclo. |
| 🏆 Contestant | Participar en todos los integradores del ciclo. |
| 🎤 Interview Ready | Completar todas las mock interviews del ciclo. |

---

## 🛠️ Guía para Mentores y Administradores

Estos comandos requieren el permiso `Manage Server`, salvo `/crear-canal-voz`, que requiere `Manage Channels`.

| Comando | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `/iniciar-sesion` | Genera el código de asistencia de una sesión con tiempo límite (15 min por defecto). | `/iniciar-sesion sesion_id:8 minutos:15` |
| `/resumen-sesion` | Muestra presentes, ausentes, justificados y quórum de una sesión. | `/resumen-sesion sesion_id:8` |
| `/importar-standings` | Abre una ventana para pegar la tabla de standings y calificar en lote. | `/importar-standings sesion_id:8 puntos_por_problema:20` |
| `/sincronizar-codeforces` | Califica consultando la API pública de Codeforces, por contest o por lista de problemas. | `/sincronizar-codeforces sesion_id:8 contest_id:106540 puntos_por_problema:10` |
| `/calificar-mock` | Registra el puntaje y el feedback de una mock interview. | `/calificar-mock correo:alumno@alumnos.uady.mx sesion_id:2 puntaje:85 feedback:Buen manejo de DP` |
| `/calificar-concurso` | Registra manualmente el puntaje de un estudiante en una sesión. | `/calificar-concurso correo:alumno@alumnos.uady.mx sesion_id:7 puntaje:60` |
| `/justificar-falta` | Marca una falta como justificada; cuenta a favor del porcentaje de asistencia. | `/justificar-falta correo:alumno@alumnos.uady.mx sesion_id:8 motivo:Cruce de horario` |
| `/crear-canal-voz` | Crea un canal principal que genera canales de voz personales. | `/crear-canal-voz nombre:Sala CPC categoria_id:123456789012345678` |
| `/configurar-logs-voz` | Elige el canal de texto para los logs de voz. | `/configurar-logs-voz canal:#logs-voz` |
| `/configurar-canal-cumpleanos` | Elige el canal donde se publican los cumpleaños. | `/configurar-canal-cumpleanos canal:#cumpleanos` |

Al calificar, si el estudiante sube de rango, la respuesta muestra el aviso **🎉 ¡NUEVO RANGO ALCANZADO!** con el rango y el XP nuevos.

### Importar standings

1. En Codeforces abre la tabla de *Standings*, selecciona las filas y cópialas (`Ctrl + C`).
2. Ejecuta `/importar-standings sesion_id:X` y pega el texto en la ventana.

Acepta filas copiadas de Codeforces o vjudge (`1  handle  3  120  +  +`) y listas simples (`handle 3`). Si un handle aparece varias veces, se conserva la fila con más problemas aceptados. Al terminar, el bot envía el resumen por páginas y un mensaje con las **filas no calificadas**:

* **Handles no encontrados**: no corresponden a ningún estudiante activo (no se vinculó, registró otro handle o no tiene status `ACTIVO`).
* **De otro grupo**: solo cuando se indica `grupo`; el estudiante existe pero pertenece a otro grupo.

Si el estudiante no tenía registro en la sesión, la importación lo crea con asistencia `PRESENTE`. Si ya tenía uno, se conserva su asistencia (por ejemplo, `JUSTIFICADO`).

### Integradores con un contest por grupo

Cada integrador es **una sola sesión** para todos los grupos. Se importa una vez por grupo con la opción `grupo`, que se autocompleta con los grupos de `estudiantes.grupo`:

```
/importar-standings sesion_id:7 grupo:G1   → standings del contest de G1
/importar-standings sesion_id:7 grupo:G2   → standings del contest de G2
```

Con `grupo`, solo se califica a estudiantes de ese grupo. `/sincronizar-codeforces` también acepta `grupo`. Los estudiantes sin grupo asignado no entran en ninguna importación por grupo: asígnales grupo en Supabase o impórtalos sin la opción `grupo`.

### Flujo semanal recomendado

1. **Al iniciar la clase:** `/iniciar-sesion sesion_id:X` y comparte el código.
2. **Durante la clase:** revisa los registros con `/resumen-sesion sesion_id:X`.
3. **Al terminar la práctica o el contest:** `/importar-standings sesion_id:X` (con `grupo` si cada grupo tuvo su propio contest).
4. **Faltas justificadas:** `/justificar-falta`.

---

## 👥 Equipos

| Comando | Descripción |
| :--- | :--- |
| `/crear-equipo` | Pide nombre y color hexadecimal (ej. `#F4511E`) y luego hasta 3 compañeros. Máximo **4 integrantes** contando al creador. Crea un rol de Discord. |
| `/gestionar-equipo` | El creador cambia los integrantes. *Cancelar* no elimina el equipo. |
| `/salir-equipo` | Un miembro sale del equipo. El creador no puede salir; debe eliminarlo. |
| `/listar-equipos` | Muestra todos los equipos, sus creadores y miembros. |
| `/eliminar-equipo` | El creador elimina su equipo. Un administrador puede indicar el rol para eliminar cualquiera. |

El rol de un equipo se borra automáticamente si queda sin miembros.

## 🎂 Cumpleaños

* `/cumpleanos mes:MM dia:DD`: registra o actualiza tu cumpleaños.
* `/listar-cumpleanos mes:MM`: muestra los cumpleaños de un mes.
* `/configurar-canal-cumpleanos canal:#cumpleanos` (administradores): canal de avisos.

El bot publica la lista del mes y un recordatorio el mismo día. Usa la zona horaria `America/Merida`, configurable con `BIRTHDAY_TIMEZONE`.

## 🔊 Canales de Voz Dinámicos

Para crear un canal principal, activa el **Modo desarrollador** de Discord, copia el ID de la categoría y ejecuta:

`/crear-canal-voz nombre:Sala CPC categoria_id:ID_DE_LA_CATEGORIA`

Puede haber varios canales principales, incluso en categorías distintas. Quien entra a uno recibe su propio canal de voz en la misma categoría, que se elimina cuando queda vacío. El dueño puede cambiarlo con:

`/configurar-mi-canal-voz nombre:Mi sala limite:5` (límite de 0 a 99; 0 = sin límite)

Con `/configurar-logs-voz` se registran la creación de canales, las entradas y salidas, y los cierres automáticos.

---

## ⚙️ Configuración Técnica

### Requisitos

* **Node.js** 22 o superior (la imagen de Docker usa Node 22).
* Proyecto de **Supabase** (PostgreSQL).
* Aplicación y bot en el **Discord Developer Portal**, con **Server Members Intent** activado.

### Variables de entorno

Copia `.env.example` como `.env` y completa los valores:

```env
DISCORD_TOKEN=token_del_bot
CLIENT_ID=id_de_la_aplicacion
GUILD_ID=id_del_servidor
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-key

# Opcionales
BIRTHDAY_TIMEZONE=America/Merida
# Zona horaria para decidir qué sesiones ya ocurrieron (por defecto la de cumpleaños)
# TIMEZONE=America/Merida
# Carpeta del estado local (por defecto ./data). Para un bot de pruebas usa ./data-test
# DATA_DIR=./data-test
```

Si falta una variable obligatoria, el bot se detiene al arrancar e indica cuál. La URL y la key están en Supabase, en `Project Settings > Data API`. Nunca publiques `.env` ni compartas sus valores.

### Base de datos (Supabase)

Tablas que usa el bot:

* **`estudiantes`**: `nombre`, `correo`, `discord_user_id`, `codeforces_handle`, `status` (`ACTIVO`), `inscrito_cpc`, `inscrito_hub`, `grupo`.
* **`ciclos`**: el ciclo con `estado = 'ACTIVO'` define qué sesiones cuentan para el XP, el progreso y el leaderboard.
* **`sesiones`**: `nombre`, `programa` (`CPC`/`HUB`), `tipo` (`PRACTICA`, `INTEGRADOR`, `MOCK`…), `fecha`, `ciclo_id`, código de asistencia.
* **`registro_sesion`**: asistencia, `puntaje_actividad` y feedback por estudiante y sesión, con restricción única `(sesion_id, estudiante_id)`.

Una sesión sin `ciclo_id` no aparece en `/mi-progreso` ni en `/leaderboard`.

### Permisos del bot en Discord

Al invitarlo, selecciona los scopes `bot` y `applications.commands`, con estos permisos:

* `View Channels`, `Send Messages`, `Embed Links`
* `Manage Channels`, `Move Members`, `Connect`, `Speak` (canales de voz)
* `Manage Roles` (equipos). El rol del bot debe estar **por encima** de los roles de equipo.

También necesita acceso a los canales de logs de voz y de cumpleaños.

### Estado local (`data/`)

Los cumpleaños, equipos y canales de voz se guardan en `data/*.json`. Esa carpeta **no se versiona**: es el estado de cada servidor. En Docker se monta como volumen (`./data:/app/data`).

> ⚠️ Al actualizar producción, **respalda `data/` antes de `git reset --hard` y restáuralo después**.

---

## 🚀 Instalación y Despliegue

### Local

```bash
npm install
npm run deploy-commands   # registra los slash commands en el servidor de GUILD_ID
npm start
```

Ejecuta `deploy-commands` de nuevo cada vez que cambien `src/commands.js`, la escala de rangos o las opciones de un comando.

Para probar cambios usa un **segundo bot de Discord** con su propio token, y en su `.env` define `DATA_DIR=./data-test`. No conectes localmente el token de producción: las dos instancias responderían a los mismos comandos.

### Producción (Docker en la VM)

```bash
cd ~/cp-club-bot
BK=~/cp-club-bot-data-backup-$(date +%F-%H%M)
cp -a data "$BK"                 # 1. respaldar el estado
git fetch origin
git reset --hard origin/main     # 2. actualizar el código
cp -a "$BK"/. data/              # 3. restaurar el estado
docker compose up -d --build     # 4. reconstruir y reiniciar
docker compose run --rm cp-club-bot node deploy-commands.js   # solo si cambiaron comandos
docker compose logs --tail=50 cp-club-bot
```

Los logs deben mostrar `CP Club Bot conectado exitosamente como: ...`. No ejecutes `git clean -fdx`: borraría `.env` y `data/`.

### Estructura del código

```text
index.js                 Arranque: valida la configuración, registra features y conecta el bot
deploy-commands.js       Registro de slash commands en Discord
src/
  commands.js            Definición de slash commands
  config.js              Variables de entorno
  interactions/          Router de interacciones y registro de handlers
  features/              Un módulo por grupo de comandos (asistencia, progreso, leaderboard,
                         calificaciones, importación, equipos, cumpleaños, voz, ayuda)
  services/              Acceso a Supabase y a la API de Codeforces
  domain/                Reglas de negocio: rangos, XP, standings, grupos, fechas de sesión
  storage/               Lectura y escritura de data/*.json
  utils/                 OTP, texto y helpers de respuestas
```

Para agregar un comando: defínelo en `src/commands.js`, implementa su handler en `src/features/` y regístralo en `src/interactions/registry.js`.
