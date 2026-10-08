import { uid } from './id.js';
import { createAuth, redactAuth, resolveAuth } from './auth.js';
import { applyParamsToUrl, buildQueryString, splitUrl } from './url.js';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
export const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

export const BODY_MODES = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Raw text' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'urlencoded', label: 'x-www-form-urlencoded' },
];

export function createRow(overrides = {}) {
  return { id: uid('row'), enabled: true, key: '', value: '', description: '', ...overrides };
}

export function createRequest(overrides = {}) {
  return {
    id: uid('req'),
    name: '',
    description: '',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    auth: createAuth(),
    body: {
      mode: 'none',
      json: '',
      text: '',
      formData: [],
      urlencoded: [],
    },
    ...overrides,
  };
}

const enabledRows = (rows = []) => rows.filter((row) => row.enabled && row.key.trim() !== '');

/** Multipart body built by hand so the proxy can forward it as a plain string. */
export function buildMultipart(rows, boundary) {
  const parts = enabledRows(rows).map(
    (row) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${row.key}"\r\n\r\n${row.value}\r\n`,
  );
  return `${parts.join('')}--${boundary}--\r\n`;
}

/** Serialise the request body according to the selected mode. */
export function buildBody(request) {
  const { method, body } = request;
  if (!body || body.mode === 'none' || METHODS_WITHOUT_BODY.has(method)) {
    return { body: null, contentType: null };
  }

  switch (body.mode) {
    case 'json':
      return body.json?.trim()
        ? { body: body.json, contentType: 'application/json' }
        : { body: null, contentType: null };
    case 'text':
      return body.text
        ? { body: body.text, contentType: 'text/plain' }
        : { body: null, contentType: null };
    case 'urlencoded': {
      const encoded = buildQueryString(body.urlencoded ?? []);
      return encoded
        ? { body: encoded, contentType: 'application/x-www-form-urlencoded' }
        : { body: null, contentType: null };
    }
    case 'form-data': {
      const rows = enabledRows(body.formData ?? []);
      if (!rows.length) return { body: null, contentType: null };
      const boundary = `----APIInspectorBoundary${Math.random().toString(36).slice(2, 12)}`;
      return {
        body: buildMultipart(rows, boundary),
        contentType: `multipart/form-data; boundary=${boundary}`,
        boundary,
      };
    }
    default:
      return { body: null, contentType: null };
  }
}

/**
 * Resolve the editor state into the exact request that will be sent.
 * Both the sender and every code generator use this, so generated snippets
 * always match what the app actually did.
 */
export function buildOutgoingRequest(request) {
  const { headers: authHeaders, params: authParams } = resolveAuth(request.auth);

  const params = [...request.params];
  for (const param of authParams) {
    params.push({ id: uid('auth'), enabled: true, key: param.key, value: param.value });
  }
  const url = applyParamsToUrl(request.url, params);

  const headers = {};
  for (const row of enabledRows(request.headers)) headers[row.key.trim()] = row.value;
  // Auth headers are applied unless the user set the same header explicitly.
  for (const [name, value] of Object.entries(authHeaders)) {
    const already = Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
    if (!already) headers[name] = value;
  }

  const { body, contentType } = buildBody(request);
  if (contentType) {
    const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
    if (!hasContentType) headers['Content-Type'] = contentType;
  }

  return { method: request.method, url, headers, body };
}

/** Preview of the final URL for the request bar hint. */
export function previewUrl(request) {
  const { params } = resolveAuth(request.auth);
  const all = [...request.params, ...params.map((p) => ({ ...p, enabled: true }))];
  return applyParamsToUrl(request.url, all);
}

/** Endpoint path used in history rows and generated documentation. */
export function endpointOf(url) {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return splitUrl(url).base || url;
  }
}

/**
 * Prepare a request for persistence. Secrets are dropped unless the user has
 * explicitly opted in to storing them.
 */
export function sanitizeForStorage(request, { keepSecrets = false } = {}) {
  const clone = JSON.parse(JSON.stringify(request));
  if (keepSecrets) return clone;
  clone.auth = redactAuth(clone.auth);
  // Header rows can hold tokens too, so redact the well known ones.
  clone.headers = clone.headers.map((row) =>
    /^(authorization|cookie|x-api-key|api-key|x-auth-token|x-access-token)$/i.test(row.key.trim())
      ? { ...row, value: '' }
      : row,
  );
  return clone;
}

/** True when the request carries credentials that would be stripped on save. */
export function hasSecrets(request) {
  if (request.auth?.type === 'bearer' && request.auth.bearer?.token) return true;
  if (request.auth?.type === 'basic' && request.auth.basic?.password) return true;
  if (request.auth?.type === 'apikey' && request.auth.apiKey?.value) return true;
  return request.headers.some(
    (row) =>
      /^(authorization|cookie|x-api-key|api-key|x-auth-token|x-access-token)$/i.test(row.key.trim()) &&
      row.value,
  );
}
