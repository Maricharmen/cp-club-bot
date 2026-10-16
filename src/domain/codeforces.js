// Reglas para decidir qué envíos de Codeforces cuentan en /sincronizar-codeforces.

function parseProblemCodes(input) {
  const codes = new Set();
  if (!input) return codes;

  for (const part of input.split(',')) {
    const code = part.trim().toUpperCase().replace(/\s+/g, '');
    if (code) codes.add(code);
  }
  return codes;
}

// Devuelve los códigos (ej. 106540G) de problemas distintos aceptados que
// pertenecen al contest indicado o a la lista de problemas buscados.
function collectAcceptedProblems(submissions, { contestId = null, problemCodes = new Set() }) {
  const accepted = new Set();

  for (const submission of submissions) {
    if (submission.verdict !== 'OK') continue;

    const submissionContestId = submission.contestId || submission.problem?.contestId;
    const index = (submission.problem?.index || '').toUpperCase();
    const fullCode = `${submissionContestId}${index}`;

    if (contestId && submissionContestId === contestId) {
      accepted.add(fullCode);
    } else if (problemCodes.has(fullCode) || problemCodes.has(index)) {
      accepted.add(fullCode);
    }
  }

  return accepted;
}

module.exports = { parseProblemCodes, collectAcceptedProblems };
