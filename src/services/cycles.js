const { supabase } = require('./supabase');

async function getActiveCycle() {
  return supabase
    .from('ciclos')
    .select('id, nombre, fecha_inicio, fecha_fin, estado')
    .eq('estado', 'ACTIVO')
    .maybeSingle();
}

async function getCycleSessions(cycleId, columns = 'id') {
  return supabase
    .from('sesiones')
    .select(columns)
    .eq('ciclo_id', cycleId)
    .order('id', { ascending: true });
}

module.exports = { getActiveCycle, getCycleSessions };
