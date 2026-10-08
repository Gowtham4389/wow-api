import { uid } from './id.js';

/** Split a URL string into its part before the query and the query itself. */
export function splitUrl(url) {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  return {
    base: queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex),
    query: queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1),
    hash,
  };
}

/** Parse a query string into editor rows, preserving order and duplicates. */
export function parseQueryString(query) {
  if (!query) return [];
  return query
    .split('&')
    .filter((pair) => pair !== '')
    .map((pair) => {
      const index = pair.indexOf('=');
      const rawKey = index === -1 ? pair : pair.slice(0, index);
      const rawValue = index === -1 ? '' : pair.slice(index + 1);
      return {
        id: uid('param'),
        enabled: true,
        key: safeDecode(rawKey),
        value: safeDecode(rawValue),
      };
    });
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/** Serialise enabled rows back into a query string. */
export function buildQueryString(params) {
  return params
    .filter((param) => param.enabled && (param.key !== '' || param.value !== ''))
    .map((param) => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`)
    .join('&');
}

/** Rebuild the URL so it always mirrors the enabled query parameter rows. */
export function applyParamsToUrl(url, params) {
  const { base, hash } = splitUrl(url);
  const query = buildQueryString(params);
  return `${base}${query ? `?${query}` : ''}${hash}`;
}

/**
 * Sync rows from a URL the user typed or pasted. Disabled rows that are not
 * present in the URL are kept so toggling a parameter off is not destructive.
 */
export function syncParamsFromUrl(url, existingParams = []) {
  const { query } = splitUrl(url);
  const fromUrl = parseQueryString(query);
  const disabled = existingParams.filter((param) => !param.enabled);
  // Reuse ids for unchanged keys so focused inputs are not remounted.
  const previousByKey = new Map(existingParams.filter((p) => p.enabled).map((p) => [p.key, p]));
  const merged = fromUrl.map((param) => {
    const previous = previousByKey.get(param.key);
    return previous ? { ...param, id: previous.id } : param;
  });
  return [...merged, ...disabled];
}

/** Basic structural validation with an actionable message. */
export function validateUrl(url) {
  const value = (url ?? '').trim();
  if (!value) return { ok: false, message: 'Enter a request URL.' };
  if (/\s/.test(value)) return { ok: false, message: 'The URL contains spaces. Encode them as %20.' };

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return { ok: false, message: 'This URL cannot be parsed. Example: https://api.example.com/users' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, message: 'Only http:// and https:// URLs can be sent.' };
  }
  if (!parsed.hostname) return { ok: false, message: 'The URL is missing a hostname.' };
  return { ok: true, url: withProtocol, parsed, normalized: withProtocol !== value };
}

/** Add `https://` when the user omitted the protocol. */
export function normalizeUrl(url) {
  const result = validateUrl(url);
  return result.ok ? result.url : url;
}
