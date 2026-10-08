import { createAuth, decodeBase64 } from './auth.js';
import { createRequest, createRow } from './request.js';
import { syncParamsFromUrl } from './url.js';

/**
 * Tokenise a shell command, honouring quotes and line continuations.
 * Only what cURL needs is supported: this is not a full shell parser.
 */
export function tokenizeCommand(input) {
  const text = String(input).replace(/\\\r?\n/g, ' ').trim();
  const tokens = [];
  let current = '';
  let quote = null;
  let hasContent = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quote) {
      if (char === '\\' && quote === '"' && i + 1 < text.length) {
        const next = text[i + 1];
        current += ['"', '\\', '$', '`'].includes(next) ? next : `\\${next}`;
        i += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      hasContent = true;
      continue;
    }
    if (char === '\\' && i + 1 < text.length) {
      current += text[i + 1];
      i += 1;
      hasContent = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (current || hasContent) tokens.push(current);
      current = '';
      hasContent = false;
      continue;
    }
    current += char;
    hasContent = true;
  }
  if (current || hasContent) tokens.push(current);
  return tokens;
}

const METHOD_FLAGS = new Set(['-X', '--request']);
const HEADER_FLAGS = new Set(['-H', '--header']);
const DATA_FLAGS = new Set(['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode']);
const FORM_FLAGS = new Set(['-F', '--form']);
const USER_FLAGS = new Set(['-u', '--user']);
// Flags that take a value we do not need, so the value must still be skipped.
const IGNORED_WITH_VALUE = new Set([
  '--connect-timeout', '-m', '--max-time', '-A', '--user-agent', '-e', '--referer', '-b', '--cookie',
  '-o', '--output', '--retry', '--cacert', '--cert', '--key', '--proxy', '-x', '--resolve', '--url',
  '--write-out', '-w', '--http1.1', '--limit-rate',
]);

/**
 * Convert a cURL command into the request editor model.
 * Returns { ok, request, warnings } - never throws on malformed input.
 */
export function parseCurl(command) {
  const tokens = tokenizeCommand(command);
  const warnings = [];

  if (!tokens.length) return { ok: false, error: 'Paste a cURL command to import.' };
  const start = tokens.findIndex((token) => token === 'curl' || token.endsWith('/curl'));
  if (start === -1) return { ok: false, error: 'This does not look like a cURL command.' };

  const request = createRequest();
  const headers = [];
  const formRows = [];
  const dataParts = [];
  let urlToken = null;
  let explicitMethod = null;
  let isUrlEncodedForm = false;

  for (let i = start + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    const next = () => tokens[i + 1];

    if (token === '--url') {
      urlToken = next();
      i += 1;
      continue;
    }
    if (METHOD_FLAGS.has(token)) {
      explicitMethod = String(next() ?? 'GET').toUpperCase();
      i += 1;
      continue;
    }
    if (HEADER_FLAGS.has(token)) {
      const raw = next() ?? '';
      i += 1;
      const separator = raw.indexOf(':');
      if (separator === -1) continue;
      const key = raw.slice(0, separator).trim();
      const value = raw.slice(separator + 1).trim();
      if (key) headers.push(createRow({ key, value }));
      continue;
    }
    if (DATA_FLAGS.has(token)) {
      const raw = next() ?? '';
      i += 1;
      if (token === '--data-urlencode') isUrlEncodedForm = true;
      dataParts.push(raw);
      continue;
    }
    if (FORM_FLAGS.has(token)) {
      const raw = next() ?? '';
      i += 1;
      const separator = raw.indexOf('=');
      const key = separator === -1 ? raw : raw.slice(0, separator);
      const value = separator === -1 ? '' : raw.slice(separator + 1);
      if (value.startsWith('@')) warnings.push(`File upload for "${key}" was skipped.`);
      formRows.push(createRow({ key, value: value.startsWith('@') ? '' : value }));
      continue;
    }
    if (USER_FLAGS.has(token)) {
      const raw = next() ?? '';
      i += 1;
      const separator = raw.indexOf(':');
      request.auth = {
        ...createAuth(),
        type: 'basic',
        basic: {
          username: separator === -1 ? raw : raw.slice(0, separator),
          password: separator === -1 ? '' : raw.slice(separator + 1),
        },
      };
      continue;
    }
    if (IGNORED_WITH_VALUE.has(token)) {
      i += 1;
      continue;
    }
    if (token.startsWith('-')) continue; // boolean flags such as -s, -L, -k, --compressed
    if (!urlToken) urlToken = token;
  }

  if (!urlToken) return { ok: false, error: 'No URL was found in the command.' };

  // An Authorization header maps onto the Authorization tab.
  const authIndex = headers.findIndex((row) => row.key.toLowerCase() === 'authorization');
  if (authIndex !== -1) {
    const value = headers[authIndex].value;
    if (/^bearer\s+/i.test(value)) {
      request.auth = { ...createAuth(), type: 'bearer', bearer: { token: value.replace(/^bearer\s+/i, '') } };
      headers.splice(authIndex, 1);
    } else if (/^basic\s+/i.test(value)) {
      try {
        const decoded = decodeBase64(value.replace(/^basic\s+/i, ''));
        const separator = decoded.indexOf(':');
        request.auth = {
          ...createAuth(),
          type: 'basic',
          basic: {
            username: separator === -1 ? decoded : decoded.slice(0, separator),
            password: separator === -1 ? '' : decoded.slice(separator + 1),
          },
        };
        headers.splice(authIndex, 1);
      } catch {
        warnings.push('The Basic auth header could not be decoded and was kept as a header.');
      }
    }
  }

  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(urlToken) ? urlToken : `https://${urlToken}`;
  const body = dataParts.join('&');
  const contentType = headers.find((row) => row.key.toLowerCase() === 'content-type')?.value ?? '';

  request.url = url;
  request.params = syncParamsFromUrl(url, []);
  request.headers = headers;

  if (formRows.length) {
    request.body = { ...request.body, mode: 'form-data', formData: formRows };
  } else if (body) {
    const looksJson = /^[\s]*[[{]/.test(body) || /json/i.test(contentType);
    if (looksJson) {
      request.body = { ...request.body, mode: 'json', json: prettyIfJson(body) };
    } else if (isUrlEncodedForm || /x-www-form-urlencoded/i.test(contentType) || /^[^=&\s]+=[^&]*(&|$)/.test(body)) {
      request.body = {
        ...request.body,
        mode: 'urlencoded',
        urlencoded: body.split('&').filter(Boolean).map((pair) => {
          const separator = pair.indexOf('=');
          return createRow({
            key: separator === -1 ? pair : decodeURIComponent(pair.slice(0, separator)),
            value: separator === -1 ? '' : decodeURIComponent(pair.slice(separator + 1).replace(/\+/g, ' ')),
          });
        }),
      };
    } else {
      request.body = { ...request.body, mode: 'text', text: body };
    }
  }

  request.method = explicitMethod ?? (body || formRows.length ? 'POST' : 'GET');
  return { ok: true, request, warnings };
}

function prettyIfJson(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
