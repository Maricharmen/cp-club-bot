function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

// En ILIKE, `%` y `_` son comodines. Se escapan para exigir coincidencia exacta
// (sin distinguir mayúsculas) y evitar que `a%` encuentre el correo de otra persona.
function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

// Agrupa líneas en páginas que respetan un máximo de líneas y de caracteres
// (las descripciones de embeds de Discord admiten como máximo 4096).
function chunkLines(lines, { maxLines, maxChars }) {
  const pages = [];
  let current = [];
  let currentLength = 0;

  for (const line of lines) {
    const addedLength = line.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && (current.length >= maxLines || currentLength + addedLength > maxChars)) {
      pages.push(current);
      current = [];
      currentLength = 0;
    }
    currentLength += line.length + (current.length > 0 ? 1 : 0);
    current.push(line);
  }

  if (current.length > 0) pages.push(current);
  return pages;
}

module.exports = { normalizeEmail, escapeLikePattern, chunkLines };
