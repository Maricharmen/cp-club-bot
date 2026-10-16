// Decide qué sesiones del ciclo ya ocurrieron. Una sesión cuenta como
// realizada si su fecha es hoy o anterior (en la zona horaria del club), si no
// tiene fecha, o si ya tiene un registro capturado (no se ocultan datos).

// Fecha local 'YYYY-MM-DD' en la zona horaria indicada.
function todayInTimeZone(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

// Acepta 'YYYY-MM-DD' o un timestamp ISO y devuelve solo la parte de fecha.
function sessionDate(session) {
  return session.fecha ? String(session.fecha).slice(0, 10) : null;
}

function isSessionHeld(session, today, record) {
  const date = sessionDate(session);
  return !date || date <= today || Boolean(record);
}

// Separa sesiones realizadas y próximas. Las próximas se ordenan por fecha.
function splitSessionsByDate(sessions, recordsBySession, today) {
  const held = [];
  const upcoming = [];

  for (const session of sessions) {
    if (isSessionHeld(session, today, recordsBySession.get(session.id))) {
      held.push(session);
    } else {
      upcoming.push(session);
    }
  }

  upcoming.sort((a, b) => sessionDate(a).localeCompare(sessionDate(b)) || a.id - b.id);
  return { held, upcoming };
}

module.exports = { todayInTimeZone, sessionDate, isSessionHeld, splitSessionsByDate };
