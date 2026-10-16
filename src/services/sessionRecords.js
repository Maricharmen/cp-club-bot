const { supabase, fetchAllRows } = require('./supabase');
const { getCycleSessions } = require('./cycles');
const { sumXp } = require('../domain/xp');

async function getRecord(sessionId, studentId, columns = '*') {
  return supabase
    .from('registro_sesion')
    .select(columns)
    .eq('sesion_id', sessionId)
    .eq('estudiante_id', studentId)
    .maybeSingle();
}

async function upsertRecord(record) {
  return supabase
    .from('registro_sesion')
    .upsert(
      { ...record, registrado_en: new Date().toISOString() },
      { onConflict: 'sesion_id,estudiante_id' }
    );
}

// Guarda un puntaje sin pisar la asistencia ya registrada (por ejemplo, un
// JUSTIFICADO). Si no había registro, el estudiante queda como PRESENTE.
async function saveScore({ sessionId, studentId, score, feedback }) {
  const { data: previous, error } = await getRecord(sessionId, studentId, 'asistencia');
  if (error) return { error };

  return upsertRecord({
    sesion_id: sessionId,
    estudiante_id: studentId,
    asistencia: previous?.asistencia || 'PRESENTE',
    puntaje_actividad: score,
    feedback
  });
}

async function listSessionRecords(sessionId) {
  return supabase
    .from('registro_sesion')
    .select('estudiante_id, asistencia, puntaje_actividad, feedback')
    .eq('sesion_id', sessionId);
}

async function listStudentRecords(studentId, sessionIds) {
  if (sessionIds.length === 0) return { data: [], error: null };

  return supabase
    .from('registro_sesion')
    .select('sesion_id, asistencia, puntaje_actividad, feedback')
    .eq('estudiante_id', studentId)
    .in('sesion_id', sessionIds);
}

async function listRecordsForSessions(sessionIds) {
  if (sessionIds.length === 0) return { data: [], error: null };

  return fetchAllRows(() => supabase
    .from('registro_sesion')
    .select('estudiante_id, puntaje_actividad, asistencia')
    .in('sesion_id', sessionIds)
    .order('sesion_id')
    .order('estudiante_id'));
}

// XP del estudiante en un ciclo, con la misma regla que /mi-progreso y /leaderboard.
async function getStudentCycleXp(studentId, cycleId) {
  const { data: sessions, error: sessionsError } = await getCycleSessions(cycleId);
  if (sessionsError) throw sessionsError;

  const { data: records, error: recordsError } = await listStudentRecords(
    studentId,
    sessions.map(session => session.id)
  );
  if (recordsError) throw recordsError;

  return sumXp(records);
}

module.exports = {
  getRecord,
  upsertRecord,
  saveScore,
  listSessionRecords,
  listStudentRecords,
  listRecordsForSessions,
  getStudentCycleXp
};
