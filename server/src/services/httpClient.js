import http from 'node:http';
import https from 'node:https';
import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { config } from '../config/index.js';
import { AppError, badRequest, upstream } from '../utils/errors.js';
import { normalizeResponseHeaders } from '../utils/headers.js';
import { pinnedLookup, validateTarget } from '../utils/ssrf.js';

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'OPTIONS', 'DELETE', 'TRACE']);

/** Case-insensitive header removal: user headers keep their original casing. */
function deleteHeader(headers, name) {
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) delete headers[key];
  }
}

/** Content types that can safely be returned to the browser as UTF-8 text. */
const TEXTUAL = [
  /^text\//i,
  /^application\/(json|.*\+json)\b/i,
  /^application\/(xml|.*\+xml)\b/i,
  /^application\/(javascript|ecmascript|x-javascript)\b/i,
  /^application\/(x-www-form-urlencoded|graphql|x-ndjson|ld\+json)\b/i,
  /^application\/(x-sh|x-yaml|yaml|csv)\b/i,
  /^image\/svg\+xml/i,
];

export function isTextualContentType(contentType = '') {
  const value = String(contentType).split(';')[0].trim();
  if (!value) return true; // no content type: assume text, the client can still switch to raw
  return TEXTUAL.some((pattern) => pattern.test(value));
}

/** Identify this client to APIs that require a User-Agent (GitHub, for one). */
export const DEFAULT_USER_AGENT = 'APIInspector/1.0';

function hasHeader(headers, name) {
  const target = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

/** Decompression stream for a Content-Encoding value, or null if unsupported. */
function decompressor(encoding) {
  switch (encoding) {
    case 'gzip':
    case 'x-gzip':
      return zlib.createGunzip();
    case 'deflate':
      return zlib.createInflate();
    case 'br':
      return zlib.createBrotliDecompress();
    case 'zstd':
      return typeof zlib.createZstdDecompress === 'function' ? zlib.createZstdDecompress() : null;
    default:
      return null;
  }
}

/**
 * Decompress a response body when the server compressed it; Node's http client
 * does not do this automatically. Decompression is streamed and stops at
 * `maxSize`, so a small compressed payload cannot expand into a huge buffer.
 */
function decompress(buffer, encoding, maxSize) {
  const algorithm = String(encoding ?? '').trim().toLowerCase();
  if (!algorithm || algorithm === 'identity' || buffer.length === 0) {
    return Promise.resolve({ buffer, decoded: false });
  }

  const stream = decompressor(algorithm);
  if (!stream) return Promise.resolve({ buffer, decoded: false });

  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    let truncated = false;
    let settled = false;

    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const finish = () => done({ buffer: Buffer.concat(chunks), decoded: true, truncated });

    stream.on('data', (chunk) => {
      if (truncated) return;
      total += chunk.length;
      if (total > maxSize) {
        truncated = true;
        const keep = Math.max(0, maxSize - (total - chunk.length));
        if (keep > 0) chunks.push(chunk.subarray(0, keep));
        stream.destroy();
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', finish);
    stream.on('close', () => {
      if (truncated) finish();
    });
    // A corrupt or partial body cannot be decoded; hand back what arrived.
    stream.on('error', () => done({ buffer, decoded: false, failed: true }));
    stream.end(buffer);
  });
}

/** Translate low level socket/TLS failures into messages that help the user. */
function describeNetworkError(error, url) {
  const host = url?.host ?? 'the server';
  const code = error?.code ?? '';
  const tlsCodes = [
    'CERT_HAS_EXPIRED',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'CERT_UNTRUSTED',
  ];

  if (tlsCodes.includes(code)) {
    return upstream(`TLS/SSL handshake with ${host} failed (${code}).`, 'ssl_error');
  }
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return badRequest(`The hostname "${url?.hostname ?? ''}" could not be resolved.`, 'dns_failure');
    case 'ECONNREFUSED':
      return upstream(`${host} refused the connection.`, 'connection_refused');
    case 'ECONNRESET':
      return upstream(`The connection to ${host} was reset before a response arrived.`, 'connection_reset');
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return upstream(`${host} is unreachable from this server.`, 'host_unreachable');
    case 'ETIMEDOUT':
    case 'ECONNABORTED':
      return upstream(`The connection to ${host} timed out.`, 'timeout');
    case 'EPROTO':
      return upstream(`A protocol error occurred while talking to ${host}.`, 'protocol_error');
    case 'ERR_INVALID_HTTP_TOKEN':
    case 'HPE_INVALID_HEADER_TOKEN':
      return upstream(`${host} returned a malformed HTTP response.`, 'malformed_response');
    default:
      return upstream(`The request to ${host} failed.`, 'network_error');
  }
}

/** Perform a single hop. Redirects are handled by the caller. */
function requestOnce({ url, addresses, method, headers, body, timeout, maxSize, signal }) {
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let firstByteAt = null;
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    const options = {
      method,
      protocol: url.protocol,
      hostname: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      headers: { ...headers, host: url.host },
      lookup: pinnedLookup(addresses),
      timeout,
      // A fresh agent per request keeps a validated connection from being
      // reused for a different (possibly re-resolved) target.
      agent: new transport.Agent({ keepAlive: false, maxSockets: 1 }),
    };
    if (url.protocol === 'https:') {
      options.servername = url.hostname.replace(/^\[|\]$/g, '');
    }

    const req = transport.request(options, (res) => {
      firstByteAt = performance.now();
      const chunks = [];
      let received = 0;
      let truncated = false;

      res.on('data', (chunk) => {
        if (truncated) return;
        received += chunk.length;
        if (received > maxSize) {
          truncated = true;
          const keep = Math.max(0, maxSize - (received - chunk.length));
          if (keep > 0) chunks.push(chunk.subarray(0, keep));
          res.destroy();
          return;
        }
        chunks.push(chunk);
      });

      const complete = () => {
        const buffer = Buffer.concat(chunks);
        finish(resolve, {
          status: res.statusCode,
          statusText: res.statusMessage || '',
          headers: normalizeResponseHeaders(res.headers),
          buffer,
          truncated,
          bytes: truncated ? maxSize : buffer.length,
          httpVersion: res.httpVersion,
          timing: {
            total: Math.round((performance.now() - startedAt) * 100) / 100,
            firstByte: firstByteAt ? Math.round((firstByteAt - startedAt) * 100) / 100 : null,
          },
        });
      };

      res.on('end', complete);
      res.on('close', () => {
        if (truncated) complete();
      });
      res.on('error', (error) => {
        if (truncated) complete();
        else finish(reject, describeNetworkError(error, url));
      });
    });

    const onAbort = () => {
      req.destroy();
      finish(reject, new AppError('The request was cancelled.', { status: 499, code: 'cancelled' }));
    };

    function cleanup() {
      signal?.removeEventListener('abort', onAbort);
      // Tearing down the agent can make the socket emit a late ECONNRESET on a
      // request we have already settled; absorb it instead of crashing.
      req.removeAllListeners('error');
      req.on('error', () => {});
      if (!req.destroyed) req.destroy();
      options.agent.destroy();
    }

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    req.on('timeout', () => {
      req.destroy();
      finish(reject, upstream(`No response from ${url.host} within ${timeout} ms.`, 'timeout'));
    });
    req.on('error', (error) => finish(reject, describeNetworkError(error, url)));

    if (body && body.length) req.write(body);
    req.end();
  });
}

/**
 * Execute a proxied request, following (and re-validating) redirects.
 * Every hop runs through the SSRF guard, so a redirect cannot reach a private
 * address even when the first hop was a legitimate public host.
 */
export async function executeRequest({
  method,
  url: initialUrl,
  headers = {},
  body = null,
  timeout = config.requestTimeout,
  maxSize = config.maxResponseSize,
  maxRedirects = config.maxRedirects,
  signal,
}) {
  let currentUrl = initialUrl;
  let currentMethod = method;
  let currentBody = METHODS_WITHOUT_BODY.has(method) ? null : body;
  let currentHeaders = { ...headers };
  // Sensible defaults that the user can always override from the Headers tab.
  if (!hasHeader(currentHeaders, 'user-agent')) currentHeaders['User-Agent'] = DEFAULT_USER_AGENT;
  if (!hasHeader(currentHeaders, 'accept')) currentHeaders.Accept = '*/*';
  if (!hasHeader(currentHeaders, 'accept-encoding')) currentHeaders['Accept-Encoding'] = 'gzip, deflate, br';
  const redirects = [];
  const startedAt = performance.now();

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const { url, addresses } = await validateTarget(currentUrl);

    deleteHeader(currentHeaders, 'content-length');
    if (currentBody && currentBody.length) {
      currentHeaders['content-length'] = String(currentBody.length);
    }

    const result = await requestOnce({
      url,
      addresses,
      method: currentMethod,
      headers: currentHeaders,
      body: currentBody,
      timeout,
      maxSize,
      signal,
    });

    const location = result.headers.location;
    const isRedirect = result.status >= 300 && result.status < 400 && location;

    if (!isRedirect) {
      const encoding = result.headers['content-encoding'];
      const { buffer, decoded, failed, truncated: expandedTruncated } = await decompress(
        result.buffer,
        encoding,
        maxSize,
      );
      return {
        ...result,
        buffer,
        bytes: decoded ? buffer.length : result.bytes,
        encodedBytes: decoded ? result.bytes : undefined,
        contentEncoding: encoding ?? null,
        decompressed: decoded,
        decompressionFailed: Boolean(failed),
        truncated: result.truncated || Boolean(expandedTruncated),
        method: currentMethod,
        finalUrl: url.toString(),
        redirects,
        totalTime: Math.round((performance.now() - startedAt) * 100) / 100,
      };
    }

    if (hop === maxRedirects) {
      throw upstream(
        `The request exceeded the maximum of ${maxRedirects} redirects.`,
        'too_many_redirects',
      );
    }

    let nextUrl;
    try {
      nextUrl = new URL(location, url).toString();
    } catch {
      throw upstream('The server returned a redirect with an invalid Location header.', 'invalid_redirect');
    }

    redirects.push({
      status: result.status,
      statusText: result.statusText,
      from: url.toString(),
      to: nextUrl,
      time: result.timing.total,
    });

    // Mirror fetch semantics: 303 (and legacy 301/302 on POST) downgrade to GET.
    if (result.status === 303 || ((result.status === 301 || result.status === 302) && currentMethod === 'POST')) {
      currentMethod = 'GET';
      currentBody = null;
      deleteHeader(currentHeaders, 'content-type');
    }

    // Never carry credentials across an origin boundary.
    if (new URL(nextUrl).origin !== url.origin) {
      deleteHeader(currentHeaders, 'authorization');
      deleteHeader(currentHeaders, 'cookie');
    }
    currentUrl = nextUrl;
  }

  throw upstream('The request could not be completed.', 'redirect_loop');
}
