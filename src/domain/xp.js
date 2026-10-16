// Regla única de XP: se suman solo los puntajes positivos de registro_sesion.
// La usan /mi-progreso, /leaderboard y las calificaciones para que coincidan.

function parseScore(value) {
  const points = Number.parseFloat(value);
  return Number.isFinite(points) && points > 0 ? points : 0;
}

function sumXp(records) {
  return records.reduce((total, record) => total + parseScore(record.puntaje_actividad), 0);
}

module.exports = { parseScore, sumXp };
