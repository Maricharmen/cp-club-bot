const { supabase } = require('./supabase');

async function findSessionById(sessionId, columns = '*') {
  return supabase
    .from('sesiones')
    .select(columns)
    .eq('id', sessionId)
    .maybeSingle();
}

async function findActiveSessionByCode(code) {
  return supabase
    .from('sesiones')
    .select('*')
    .eq('codigo_asistencia', code)
    .eq('activa', true)
    .maybeSingle();
}

async function openAttendance(sessionId, code, expiresAt) {
  return supabase
    .from('sesiones')
    .update({
      codigo_asistencia: code,
      codigo_expira_en: expiresAt.toISOString(),
      activa: true
    })
    .eq('id', sessionId);
}

module.exports = { findSessionById, findActiveSessionByCode, openAttendance };
