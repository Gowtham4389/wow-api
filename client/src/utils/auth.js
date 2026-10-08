/**
 * Authorization is resolved at send time so credentials live in one place and
 * never have to be duplicated into the header rows.
 */
export const AUTH_TYPES = [
  { value: 'none', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'apikey', label: 'API Key' },
];

export function createAuth() {
  return {
    type: 'none',
    bearer: { token: '' },
    basic: { username: '', password: '' },
    apiKey: { key: '', value: '', in: 'header' },
  };
}

/** Base64 for arbitrary unicode input (btoa only handles latin1). */
export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeBase64(text) {
  const binary = atob(text.replace(/\s+/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Resolve auth into concrete headers and query parameters.
 * Returns empty contributions when the configuration is incomplete so a
 * half-filled form never sends a broken `Authorization: Bearer undefined`.
 */
export function resolveAuth(auth) {
  const result = { headers: {}, params: [] };
  if (!auth || auth.type === 'none') return result;

  if (auth.type === 'bearer') {
    const token = auth.bearer?.token?.trim();
    if (token) result.headers.Authorization = `Bearer ${token}`;
    return result;
  }
  if (auth.type === 'basic') {
    const { username = '', password = '' } = auth.basic ?? {};
    if (username || password) {
      result.headers.Authorization = `Basic ${encodeBase64(`${username}:${password}`)}`;
    }
    return result;
  }
  if (auth.type === 'apikey') {
    const { key, value, in: target } = auth.apiKey ?? {};
    if (key) {
      if (target === 'query') result.params.push({ key, value: value ?? '' });
      else result.headers[key] = value ?? '';
    }
  }
  return result;
}

/** Describe the auth configuration for documentation, without the secret. */
export function describeAuth(auth) {
  switch (auth?.type) {
    case 'bearer':
      return 'Bearer token (`Authorization: Bearer <token>`)';
    case 'basic':
      return 'HTTP Basic authentication (`Authorization: Basic <base64(user:password)>`)';
    case 'apikey':
      return auth.apiKey?.in === 'query'
        ? `API key sent as the query parameter \`${auth.apiKey?.key || '<key>'}\``
        : `API key sent as the header \`${auth.apiKey?.key || '<key>'}\``;
    default:
      return 'None';
  }
}

/** Strip secrets before a request is written to localStorage. */
export function redactAuth(auth) {
  if (!auth || auth.type === 'none') return createAuth();
  return {
    ...createAuth(),
    type: auth.type,
    apiKey: { key: auth.apiKey?.key ?? '', value: '', in: auth.apiKey?.in ?? 'header' },
    basic: { username: auth.basic?.username ?? '', password: '' },
    bearer: { token: '' },
  };
}
