import { badRequest } from './errors.js';

/**
 * Hop-by-hop and connection specific headers. These describe the connection
 * between the browser and this server, so they must never be forwarded to the
 * external API.
 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'http2-settings',
]);

/** Headers the proxy computes itself; a client supplied value would corrupt the request. */
const MANAGED = new Set(['host', 'content-length', 'expect', ':method', ':path', ':scheme', ':authority']);

/** Headers that leak the caller's environment if forwarded verbatim. */
const FORWARDING = new Set([
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-port',
  'x-real-ip',
  'forwarded',
  'cf-connecting-ip',
  'true-client-ip',
]);

const TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
// Printable ASCII plus tab; explicitly excludes CR/LF so header injection is impossible.
const VALUE_RE = /^[\t\x20-\x7e\x80-\xff]*$/;

export const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'x-access-token',
]);

/**
 * Validate and filter headers supplied by the client.
 * Returns a plain object safe to hand to http.request.
 */
export function sanitizeRequestHeaders(input, { maxHeaders = 60 } = {}) {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('Headers must be sent as an object of name/value pairs.', 'invalid_headers');
  }

  const entries = Object.entries(input);
  if (entries.length > maxHeaders) {
    throw badRequest(`Too many headers (limit ${maxHeaders}).`, 'too_many_headers');
  }

  const result = {};
  const dropped = [];
  for (const [rawName, rawValue] of entries) {
    const name = String(rawName).trim();
    if (!name) continue;
    if (!TOKEN_RE.test(name)) {
      throw badRequest(`"${name}" is not a valid header name.`, 'invalid_header_name');
    }
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower) || MANAGED.has(lower) || FORWARDING.has(lower) || lower.startsWith('proxy-')) {
      dropped.push(lower);
      continue;
    }
    const value = rawValue === undefined || rawValue === null ? '' : String(rawValue);
    if (!VALUE_RE.test(value)) {
      throw badRequest(`The value of header "${name}" contains characters that are not allowed.`, 'invalid_header_value');
    }
    if (value.length > 8192) {
      throw badRequest(`The value of header "${name}" is too long.`, 'header_too_long');
    }
    result[name] = value;
  }
  return { headers: result, dropped };
}

/** Normalise Node's response headers into a plain object (arrays joined). */
export function normalizeResponseHeaders(headers) {
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    result[name] = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  }
  return result;
}

/** Replace sensitive values before anything is written to a log line. */
export function redactHeaders(headers) {
  const result = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    result[name] = SENSITIVE_HEADERS.has(name.toLowerCase()) ? '[redacted]' : value;
  }
  return result;
}
