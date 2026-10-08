/** Flatten nested objects into dot paths so a CSV can represent them. */
function flatten(value, prefix = '', target = {}) {
  if (value === null || typeof value !== 'object') {
    target[prefix || 'value'] = value;
    return target;
  }
  if (Array.isArray(value)) {
    // Arrays of scalars stay in one cell; arrays of objects are indexed.
    if (value.every((item) => item === null || typeof item !== 'object')) {
      target[prefix || 'value'] = value.join('; ');
      return target;
    }
    value.forEach((item, index) => flatten(item, prefix ? `${prefix}.${index}` : String(index), target));
    return target;
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, target);
  }
  return target;
}

const escapeCell = (value, delimiter) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /["\n\r]|^\s|\s$/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Find the array worth exporting inside a response object. */
export function findCsvCandidate(data) {
  if (Array.isArray(data)) return { rows: data, source: null };
  if (data && typeof data === 'object') {
    const entry = Object.entries(data).find(
      ([, value]) => Array.isArray(value) && value.length && value.every((item) => item && typeof item === 'object'),
    );
    if (entry) return { rows: entry[1], source: entry[0] };
    return { rows: [data], source: null };
  }
  return { rows: null, source: null };
}

/** Convert an array of objects (or any JSON) into CSV text. */
export function jsonToCsv(data, { delimiter = ',', newline = '\r\n' } = {}) {
  const { rows, source } = findCsvCandidate(data);
  if (!rows || !rows.length) {
    return { ok: false, error: 'No array of records was found to convert.' };
  }

  const flatRows = rows.map((row) =>
    row && typeof row === 'object' ? flatten(row) : { value: row },
  );
  const columns = [];
  const seen = new Set();
  for (const row of flatRows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  const lines = [columns.map((column) => escapeCell(column, delimiter)).join(delimiter)];
  for (const row of flatRows) {
    lines.push(columns.map((column) => escapeCell(row[column], delimiter)).join(delimiter));
  }
  return { ok: true, text: lines.join(newline), rows: rows.length, columns: columns.length, source };
}

/** Split CSV text into rows, honouring quoted fields and embedded newlines. */
export function parseCsv(text, delimiter) {
  const separator = delimiter ?? detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === separator) {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return { rows: rows.filter((entry) => entry.length > 1 || entry[0] !== ''), delimiter: separator };
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** Convert CSV text into an array of objects. */
export function csvToJson(text, { delimiter, coerceTypes = true } = {}) {
  if (!text.trim()) return { ok: false, error: 'The input is empty.' };
  const { rows, delimiter: used } = parseCsv(text.trim(), delimiter);
  if (rows.length < 1) return { ok: false, error: 'No rows were found.' };

  const [header, ...body] = rows;
  const columns = header.map((name, index) => name.trim() || `column_${index + 1}`);
  const records = body.map((row) => {
    const record = {};
    columns.forEach((column, index) => {
      const raw = row[index] ?? '';
      record[column] = coerceTypes ? coerce(raw) : raw;
    });
    return record;
  });
  return { ok: true, data: records, text: JSON.stringify(records, null, 2), delimiter: used, rows: records.length };
}

function coerce(value) {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed) && Number.isFinite(Number(trimmed))) {
    return Number(trimmed);
  }
  return value;
}
