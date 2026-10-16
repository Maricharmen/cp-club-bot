// Grupos de estudiantes (columna estudiantes.grupo, ej. G1, G2, Virtual).
// Cada grupo puede tener su propio contest en un integrador; las
// importaciones con grupo solo califican a estudiantes de ese grupo.

function normalizeGroup(value) {
  return String(value ?? '').trim().toLowerCase();
}

function belongsToGroup(student, group) {
  return normalizeGroup(student.grupo) === normalizeGroup(group);
}

// Devuelve el nombre del grupo tal como está en la base (ej. 'g1' -> 'G1'),
// o null si no existe.
function resolveGroup(input, groups) {
  return groups.find(group => normalizeGroup(group) === normalizeGroup(input)) || null;
}

// Grupos distintos y ordenados, sin vacíos.
function uniqueGroups(values) {
  const byKey = new Map();
  for (const value of values) {
    const key = normalizeGroup(value);
    if (key && !byKey.has(key)) byKey.set(key, String(value).trim());
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

// Separa resultados de standings: los del grupo se califican; los demás se
// reportan con el grupo al que pertenecen.
function partitionResultsByGroup(results, group) {
  const inGroup = [];
  const otherGroup = [];

  for (const result of results) {
    if (belongsToGroup(result.student, group)) {
      inGroup.push(result);
    } else {
      otherGroup.push(result);
    }
  }

  return { inGroup, otherGroup };
}

module.exports = { normalizeGroup, belongsToGroup, resolveGroup, uniqueGroups, partitionResultsByGroup };
