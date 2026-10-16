const API_BASE_URL = 'https://codeforces.com/api';
const SUBMISSIONS_PER_REQUEST = 100;
const REQUEST_TIMEOUT_MS = 15_000;

// Devuelve los últimos envíos del usuario. Lanza un error si la API falla para
// que quien llama pueda reportar el handle en lugar de ignorarlo en silencio.
async function fetchRecentSubmissions(handle) {
  const url = `${API_BASE_URL}/user.status?handle=${encodeURIComponent(handle)}&from=1&count=${SUBMISSIONS_PER_REQUEST}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body = await response.json();

  if (body.status !== 'OK' || !Array.isArray(body.result)) {
    throw new Error(body.comment || `Codeforces respondió HTTP ${response.status}`);
  }

  return body.result;
}

module.exports = { fetchRecentSubmissions };
