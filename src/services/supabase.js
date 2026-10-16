const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(
  config.supabaseUrl,
  config.supabaseKey,
  { auth: { persistSession: false } }
);

const PAGE_SIZE = 1000;

// PostgREST corta los resultados al límite de filas del proyecto (1000 por defecto).
// Pide páginas hasta recibir una vacía para no perder registros en silencio.
async function fetchAllRows(buildQuery) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    if (data.length === 0) return { data: rows, error: null };
    rows.push(...data);
  }
}

module.exports = { supabase, fetchAllRows };
