import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import { config } from '../config/index.js';
import { badRequest, blocked } from './errors.js';
import { isBlockedAddress } from './ip.js';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Hostnames that resolve inside private/infrastructure networks. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.localdomain',
  '.internal',
  '.intranet',
  '.private',
  '.corp',
  '.home',
  '.home.arpa',
  '.lan',
  '.svc',
  '.cluster.local',
];

/**
 * Parse and structurally validate a user supplied URL.
 * Throws an AppError for anything that must not be requested.
 */
export function parseTargetUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw badRequest('A request URL is required.', 'missing_url');
  }
  const value = rawUrl.trim();
  if (value.length > 8192) {
    throw badRequest('The request URL is too long.', 'url_too_long');
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw badRequest(
      'The URL could not be parsed. Include a protocol, for example https://api.example.com.',
      'invalid_url',
    );
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw badRequest(`Only http and https URLs can be requested (received "${url.protocol}").`, 'invalid_protocol');
  }
  if (url.username || url.password) {
    throw badRequest(
      'Credentials in the URL are not supported. Use the Authorization tab instead.',
      'url_credentials',
    );
  }
  if (!url.hostname) {
    throw badRequest('The URL is missing a hostname.', 'invalid_url');
  }
  return url;
}

/** Hostname level checks applied before any DNS lookup happens. */
export function assertHostnameAllowed(hostname) {
  if (config.allowPrivateNetwork) return;

  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

  if (BLOCKED_HOSTNAMES.has(host)) {
    throw blocked(`Requests to "${hostname}" are not allowed.`, 'blocked_hostname');
  }
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw blocked(`Requests to internal hostnames ("${hostname}") are not allowed.`, 'blocked_hostname');
  }
  // Single label hostnames such as "router" or "gitlab" only resolve on internal networks.
  if (!host.includes('.') && isIP(host) === 0) {
    throw blocked(
      `"${hostname}" looks like an internal hostname. Use a fully qualified public domain.`,
      'blocked_hostname',
    );
  }
  if (isIP(host) !== 0 && isBlockedAddress(host)) {
    throw blocked(`Requests to the private or reserved address "${hostname}" are not allowed.`, 'blocked_address');
  }
}

/**
 * Resolve a hostname and reject if *any* resolved address is private.
 * Returns the addresses so the caller can pin the connection to one of them,
 * which closes the DNS rebinding window between validation and connect.
 */
export async function resolveAllowedAddresses(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');

  if (isIP(host) !== 0) {
    if (!config.allowPrivateNetwork && isBlockedAddress(host)) {
      throw blocked(`Requests to the private or reserved address "${hostname}" are not allowed.`, 'blocked_address');
    }
    return [{ address: host, family: isIP(host) }];
  }

  let records;
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch (error) {
    if (error && (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN')) {
      throw badRequest(`The hostname "${hostname}" could not be resolved (DNS lookup failed).`, 'dns_failure');
    }
    throw badRequest(`The hostname "${hostname}" could not be resolved.`, 'dns_failure');
  }

  if (!records.length) {
    throw badRequest(`The hostname "${hostname}" did not resolve to any address.`, 'dns_failure');
  }
  if (!config.allowPrivateNetwork) {
    const offending = records.find((record) => isBlockedAddress(record.address));
    if (offending) {
      throw blocked(
        `"${hostname}" resolves to a private or reserved address and cannot be requested.`,
        'blocked_address',
      );
    }
  }
  return records.map((record) => ({ address: record.address, family: record.family }));
}

/** Full validation for one hop (initial request or a redirect target). */
export async function validateTarget(rawUrl) {
  const url = parseTargetUrl(rawUrl);
  assertHostnameAllowed(url.hostname);
  const addresses = await resolveAllowedAddresses(url.hostname);
  return { url, addresses };
}

/**
 * Build a `lookup` implementation for http.request that always returns an
 * address we already validated, so the socket cannot connect somewhere else.
 */
export function pinnedLookup(addresses) {
  return function lookup(_hostname, options, callback) {
    const done = typeof options === 'function' ? options : callback;
    const family = typeof options === 'object' && options ? options.family : 0;
    const candidates = family
      ? addresses.filter((entry) => entry.family === family)
      : addresses;
    const pool = candidates.length ? candidates : addresses;

    if (typeof options === 'object' && options && options.all) {
      done(null, pool.map((entry) => ({ address: entry.address, family: entry.family })));
      return;
    }
    const [first] = pool;
    done(null, first.address, first.family);
  };
}
