// Parser del texto pegado en /importar-standings. Acepta filas copiadas de
// Codeforces, vjudge o listas simples "handle AC".

const HEADER_PATTERN = /^(#|Rank|Who|Penalty|User|=|Score|Handle|Participante|Nombre)/i;

function cleanHandleToken(token) {
  return token.replace(/^[#@.(-]+|[).,-]+$/g, '').toLowerCase();
}

function countAccepted(tokensAfterHandle) {
  for (const token of tokensAfterHandle) {
    const number = token.replace(/^=+/, '');
    if (/^\d+$/.test(number)) return Number.parseInt(number, 10);
  }

  // Formato de standings con una columna "+" por problema aceptado.
  return tokensAfterHandle.filter(token => token.startsWith('+')).length;
}

function parseStandingsLine(line, studentsByHandle) {
  const trimmed = line.trim();
  if (!trimmed || HEADER_PATTERN.test(trimmed)) return null;

  const tokens = trimmed.split(/[\s,;:\t|]+/).filter(Boolean);
  const handleIndex = tokens.findIndex(token => studentsByHandle.has(cleanHandleToken(token)));
  if (handleIndex === -1) return null;

  return {
    student: studentsByHandle.get(cleanHandleToken(tokens[handleIndex])),
    accepted: countAccepted(tokens.slice(handleIndex + 1))
  };
}

// Devuelve un resultado por estudiante. Si el handle aparece varias veces en
// el texto pegado se conserva la fila con más problemas aceptados.
function parseStandings(text, students) {
  const studentsByHandle = new Map(
    students.map(student => [student.codeforces_handle.trim().toLowerCase(), student])
  );
  const results = new Map();

  for (const line of text.split(/\r?\n/)) {
    const result = parseStandingsLine(line, studentsByHandle);
    if (!result) continue;

    const previous = results.get(result.student.id);
    if (!previous || result.accepted > previous.accepted) {
      results.set(result.student.id, result);
    }
  }

  return [...results.values()];
}

module.exports = { parseStandings };
