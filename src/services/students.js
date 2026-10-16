const { supabase, fetchAllRows } = require('./supabase');
const { escapeLikePattern } = require('../utils/text');
const { uniqueGroups } = require('../domain/groups');

async function findStudentByEmail(email, columns = '*') {
  return supabase
    .from('estudiantes')
    .select(columns)
    .ilike('correo', escapeLikePattern(email))
    .maybeSingle();
}

async function findStudentByDiscordId(discordId, columns = '*') {
  return supabase
    .from('estudiantes')
    .select(columns)
    .eq('discord_user_id', discordId)
    .maybeSingle();
}

// ¿Esta cuenta de Discord ya está vinculada a un estudiante distinto?
async function isDiscordLinkedToOtherStudent(discordId, studentId) {
  const { data, error } = await supabase
    .from('estudiantes')
    .select('id')
    .eq('discord_user_id', discordId)
    .neq('id', studentId)
    .limit(1);

  return { linked: (data || []).length > 0, error };
}

async function updateStudent(studentId, changes) {
  return supabase
    .from('estudiantes')
    .update({ ...changes, actualizado_en: new Date().toISOString() })
    .eq('id', studentId);
}

async function listActiveStudents(columns) {
  return supabase
    .from('estudiantes')
    .select(columns)
    .eq('status', 'ACTIVO');
}

async function listActiveStudentsWithHandle() {
  return supabase
    .from('estudiantes')
    .select('id, nombre, codeforces_handle, grupo')
    .not('codeforces_handle', 'is', null)
    .eq('status', 'ACTIVO');
}

// Grupos que existen entre los estudiantes activos (ej. G1, G2, Virtual).
async function listActiveGroups() {
  const { data, error } = await fetchAllRows(() => supabase
    .from('estudiantes')
    .select('grupo')
    .eq('status', 'ACTIVO')
    .not('grupo', 'is', null)
    .order('id'));
  if (error) return { data: null, error };

  return { data: uniqueGroups(data.map(row => row.grupo)), error: null };
}

async function listActiveStudentsInProgram(program, columns) {
  let query = supabase.from('estudiantes').select(columns).eq('status', 'ACTIVO');
  if (program === 'CPC') query = query.eq('inscrito_cpc', true);
  if (program === 'HUB') query = query.eq('inscrito_hub', true);
  return query;
}

module.exports = {
  findStudentByEmail,
  findStudentByDiscordId,
  isDiscordLinkedToOtherStudent,
  updateStudent,
  listActiveStudents,
  listActiveStudentsWithHandle,
  listActiveStudentsInProgram,
  listActiveGroups
};
