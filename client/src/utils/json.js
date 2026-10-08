/**
 * JSON helpers shared by the body editor, the response viewer and the tools
 * page. `parseJson` never throws; it returns a structured result including a
 * line/column so the UI can point at the problem.
 */
export function parseJson(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, error: 'The input is empty.', data: undefined };
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch (error) {
    return { ok: false, ...describeJsonError(error, text) };
  }
}

/** Turn a SyntaxError into a message with a line and column. */
export function describeJsonError(error, text) {
  const message = error?.message ?? 'Invalid JSON';
  const match = /position (\d+)/i.exec(message);
  if (!match) return { error: message, line: null, column: null };

  const position = Number(match[1]);
  const upTo = text.slice(0, position);
  const line = upTo.split('\n').length;
  const column = position - upTo.lastIndexOf('\n');
  const cleaned = message.replace(/\s*in JSON at position \d+.*/i, '');
  return { error: `${cleaned} (line ${line}, column ${column})`, line, column, position };
}

export function formatJson(text, indent = 2) {
  const result = parseJson(text);
  if (!result.ok) return result;
  return { ok: true, data: result.data, text: JSON.stringify(result.data, null, indent) };
}

export function minifyJson(text) {
  const result = parseJson(text);
  if (!result.ok) return result;
  return { ok: true, data: result.data, text: JSON.stringify(result.data) };
}

/** True when the content type indicates JSON. */
export function isJsonContentType(contentType = '') {
  return /(^|\/|\+)json\b/i.test(String(contentType).split(';')[0].trim());
}

export function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/** Render a scalar the way it appears in the JSON tree. */
export function displayValue(value) {
  const type = typeOf(value);
  if (type === 'string') return `"${value}"`;
  if (type === 'null') return 'null';
  return String(value);
}
