// Tabla monoespaciada del historial por sesión que muestra /mi-progreso.

const NAME_WIDTH = 19;
const POINTS_WIDTH = 6;
// Límite de Discord para el valor de un campo de embed.
const MAX_FIELD_LENGTH = 1024;

const ATTENDANCE_ICONS = {
  PRESENTE: '✅',
  JUSTIFICADO: '⚠️',
  AUSENTE: '❌'
};

function truncateName(name) {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > NAME_WIDTH ? `${clean.slice(0, NAME_WIDTH - 1)}…` : clean.padEnd(NAME_WIDTH);
}

function formatSessionRow(session, record) {
  const icon = ATTENDANCE_ICONS[record?.asistencia] || ATTENDANCE_ICONS.AUSENTE;
  const points = Number.parseFloat(record?.puntaje_actividad);
  const pointsText = Number.isFinite(points) ? points.toFixed(1) : '—';
  return `${truncateName(session.nombre)} │  ${icon}  │ ${pointsText.padStart(POINTS_WIDTH)}`;
}

const HEADER = [
  `${'SESIÓN'.padEnd(NAME_WIDTH)} │ ASIS │ ${'PUNTOS'.padStart(POINTS_WIDTH)}`,
  `${'─'.repeat(NAME_WIDTH)}─┼──────┼─${'─'.repeat(POINTS_WIDTH)}`
];

function wrapBlock(rows) {
  return `\`\`\`text\n${[...HEADER, ...rows].join('\n')}\n\`\`\``;
}

// Devuelve uno o más bloques ```text``` que caben cada uno en un campo de embed.
function renderSessionTables(sessions, recordsBySession) {
  if (sessions.length === 0) return [];

  const rows = sessions.map(session => formatSessionRow(session, recordsBySession.get(session.id)));
  const blocks = [];
  let current = [];

  for (const row of rows) {
    if (current.length > 0 && wrapBlock([...current, row]).length > MAX_FIELD_LENGTH) {
      blocks.push(wrapBlock(current));
      current = [];
    }
    current.push(row);
  }

  blocks.push(wrapBlock(current));
  return blocks;
}

const shortDateFormat = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// 'YYYY-MM-DD' -> '22 oct'. Se interpreta al mediodía UTC para que la zona
// horaria no corra el día.
function formatShortDate(date) {
  return shortDateFormat.format(new Date(`${date}T12:00:00Z`)).replace('.', '');
}

// Línea bajo el historial con la siguiente sesión y cuántas faltan.
// Recibe las sesiones próximas ya ordenadas por fecha.
function formatUpcomingLine(upcoming) {
  if (upcoming.length === 0) return null;

  const [next] = upcoming;
  const date = String(next.fecha).slice(0, 10);
  const pending = upcoming.length === 1 ? '1 sesión pendiente' : `${upcoming.length} sesiones pendientes`;
  return `🕒 Próxima: **${next.nombre}** (${formatShortDate(date)}) · ${pending}`;
}

module.exports = { renderSessionTables, formatSessionRow, truncateName, formatUpcomingLine, MAX_FIELD_LENGTH };
