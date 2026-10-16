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

// "`a`, `b`, `c`" sin pasar de maxChars; si no caben todos agrega "…y N más".
function formatCodeList(items, maxChars) {
  const parts = [];
  let length = 0;

  for (let i = 0; i < items.length; i++) {
    const part = `\`${items[i]}\``;
    const remaining = items.length - i - 1;
    const suffix = remaining > 0 ? ` …y ${remaining} más`.length : 0;
    const added = (parts.length > 0 ? 2 : 0) + part.length;

    if (length + added + suffix > maxChars) {
      return `${parts.join(', ')} …y ${items.length - i} más`;
    }
    parts.push(part);
    length += added;
  }

  return parts.join(', ');
}

module.exports = { normalizeEmail, escapeLikePattern, chunkLines, formatCodeList };
