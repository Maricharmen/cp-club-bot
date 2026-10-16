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

// Para filas sin coincidencia: el primer token con letras es el handle más
// probable (la posición y los conteos son numéricos).
function guessHandle(tokens) {
  const token = tokens.find(candidate => /\p{L}/u.test(candidate));
  return token ? token.replace(/^[#@.(-]+|[).,-]+$/g, '') : null;
}

function parseStandingsLine(line, studentsByHandle) {
  const trimmed = line.trim();
  if (!trimmed || HEADER_PATTERN.test(trimmed)) return null;

  const tokens = trimmed.split(/[\s,;:\t|]+/).filter(Boolean);
  const handleIndex = tokens.findIndex(token => studentsByHandle.has(cleanHandleToken(token)));
  if (handleIndex === -1) {
    const handle = guessHandle(tokens);
    return handle ? { unmatchedHandle: handle } : null;
  }

  return {
    student: studentsByHandle.get(cleanHandleToken(tokens[handleIndex])),
    accepted: countAccepted(tokens.slice(handleIndex + 1))
  };
}

// Devuelve un resultado por estudiante y los handles que no coinciden con
// ningún estudiante. Si un handle aparece varias veces en el texto pegado se
// conserva la fila con más problemas aceptados.
function parseStandings(text, students) {
  const studentsByHandle = new Map(
    students.map(student => [student.codeforces_handle.trim().toLowerCase(), student])
  );
  const results = new Map();
  const unmatched = new Map();

  for (const line of text.split(/\r?\n/)) {
    const parsed = parseStandingsLine(line, studentsByHandle);
    if (!parsed) continue;

    if (parsed.unmatchedHandle) {
      const key = parsed.unmatchedHandle.toLowerCase();
      if (!unmatched.has(key)) unmatched.set(key, parsed.unmatchedHandle);
      continue;
    }

    const previous = results.get(parsed.student.id);
    if (!previous || parsed.accepted > previous.accepted) {
      results.set(parsed.student.id, parsed);
    }
  }

  return { results: [...results.values()], unmatchedHandles: [...unmatched.values()] };
}

module.exports = { parseStandings };
