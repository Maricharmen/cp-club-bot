const supabase = require('./supabase');

async function getActiveCycle() {
  return supabase
    .from('ciclos')
    .select('id, nombre, fecha_inicio, fecha_fin, estado')
    .eq('estado', 'ACTIVO')
    .maybeSingle();
}

module.exports = { getActiveCycle };
