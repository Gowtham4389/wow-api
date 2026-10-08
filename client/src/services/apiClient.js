import { buildOutgoingRequest } from '../utils/request.js';

/** Empty in development so the Vite dev proxy forwards /api to the server. */
const API_BASE = (import.meta.env?.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const apiUrl = (path) => `${API_BASE}${path}`;

/** Messages tuned to what the user can actually do about the failure. */
const ERROR_HINTS = {
  blocked_hostname: 'The proxy only reaches public hosts. Use Direct mode for local APIs.',
  blocked_address: 'The proxy only reaches public hosts. Use Direct mode for local APIs.',
  dns_failure: 'Check the domain name for typos.',
  timeout: 'The API did not respond in time. Try again or raise the timeout.',
  rate_limited: 'Too many requests were sent. Wait a moment before retrying.',
  ssl_error: 'The certificate of the target server could not be verified.',
  connection_refused: 'Nothing is listening on that host and port.',
  payload_too_large: 'Reduce the size of the request body.',
};

export class RequestError extends Error {
  constructor(message, { code = 'request_failed', hint, status } = {}) {
    super(message);
    this.name = 'RequestError';
    this.code = code;
    this.hint = hint ?? ERROR_HINTS[code];
    this.status = status;
  }
}

/** Fetch the proxy limits so the UI can warn before the server has to. */
export async function fetchProxyInfo(signal) {
  const response = await fetch(apiUrl('/api/proxy/info'), { signal });
  if (!response.ok) throw new RequestError('The API Inspector backend is not reachable.', { code: 'backend_unavailable' });
  return response.json();
}

/** Send through the backend proxy: full headers, no CORS restrictions. */
async function sendViaProxy(outgoing, { signal, timeout }) {
  let response;
  try {
    response = await fetch(apiUrl('/api/proxy'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: outgoing.method,
        url: outgoing.url,
        headers: outgoing.headers,
        body: outgoing.body,
        timeout,
      }),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new RequestError(
      'The API Inspector backend could not be reached. Is the server running?',
      { code: 'backend_unavailable' },
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new RequestError(error.message ?? 'The request failed.', {
      code: error.code ?? 'request_failed',
      status: response.status,
    });
  }
  return { ...payload, via: 'proxy' };
}

/**
 * Send straight from the browser. Useful for localhost APIs the proxy blocks,
 * but subject to CORS and with only the CORS-exposed response headers.
 */
async function sendDirect(outgoing, { signal }) {
  const start = performance.now();
  let response;
  try {
    response = await fetch(outgoing.url, {
      method: outgoing.method,
      headers: outgoing.headers,
      body: outgoing.body ?? undefined,
      signal,
      redirect: 'follow',
      credentials: 'omit',
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new RequestError(
      'The browser blocked this request. This is usually CORS: the API did not allow a cross-origin call. Switch to Proxy mode.',
      { code: 'cors_failure' },
    );
  }

  const buffer = await response.arrayBuffer();
  const time = Math.round((performance.now() - start) * 100) / 100;
  const headers = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  const contentType = headers['content-type'] ?? '';
  const textual = !/^(image|audio|video|application\/(octet-stream|pdf|zip))/i.test(contentType);

  return {
    status: response.status,
    statusText: response.statusText,
    headers,
    body: textual ? new TextDecoder().decode(buffer) : arrayBufferToBase64(buffer),
    bodyEncoding: textual ? 'utf8' : 'base64',
    contentType,
    size: buffer.byteLength,
    time,
    timing: { total: time, firstByte: null },
    finalUrl: response.url || outgoing.url,
    requestUrl: outgoing.url,
    method: outgoing.method,
    redirects: response.redirected ? [{ from: outgoing.url, to: response.url, status: null, statusText: 'redirected' }] : [],
    truncated: false,
    via: 'direct',
    limitedHeaders: true,
  };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Send the current editor state.
 * `mode` is 'proxy' (default) or 'direct'.
 */
export async function sendRequest(request, { mode = 'proxy', signal, timeout } = {}) {
  const outgoing = buildOutgoingRequest(request);
  const start = performance.now();
  const result = mode === 'direct'
    ? await sendDirect(outgoing, { signal })
    : await sendViaProxy(outgoing, { signal, timeout });

  return {
    ...result,
    roundTrip: Math.round((performance.now() - start) * 100) / 100,
    sentAt: Date.now(),
    request: { method: outgoing.method, url: outgoing.url, headers: outgoing.headers, hasBody: Boolean(outgoing.body) },
  };
}

/**
 * Benchmark helper: run the same request a bounded number of times and
 * summarise the timings. Requests are sequential so this stays a measurement
 * tool rather than a load generator.
 */
export const PERF_RUN_OPTIONS = [5, 10, 25, 50];
export const PERF_MAX_RUNS = 50;

export async function runPerformanceTest(request, { runs = 5, mode = 'proxy', signal, onProgress } = {}) {
  const total = Math.min(Math.max(1, runs), PERF_MAX_RUNS);
  const samples = [];
  const failures = [];

  for (let index = 0; index < total; index += 1) {
    if (signal?.aborted) break;
    try {
      const result = await sendRequest(request, { mode, signal });
      samples.push({ index, time: result.time ?? result.roundTrip, status: result.status, size: result.size });
    } catch (error) {
      if (error?.name === 'AbortError') break;
      failures.push({ index, message: error.message, code: error.code });
    }
    onProgress?.({ completed: index + 1, total, samples: [...samples], failures: [...failures] });
    // Small pause so a burst of requests never looks like an attack.
    if (index < total - 1) await new Promise((resolve) => setTimeout(resolve, 60));
  }

  return summarizePerformance(samples, failures, total);
}

export function summarizePerformance(samples, failures, total) {
  const times = samples.map((sample) => sample.time).filter((time) => Number.isFinite(time)).sort((a, b) => a - b);
  const sum = times.reduce((acc, time) => acc + time, 0);
  const median = times.length
    ? times.length % 2
      ? times[(times.length - 1) / 2]
      : (times[times.length / 2 - 1] + times[times.length / 2]) / 2
    : null;

  return {
    total,
    completed: samples.length + failures.length,
    successes: samples.length,
    failures,
    fastest: times[0] ?? null,
    slowest: times[times.length - 1] ?? null,
    average: times.length ? sum / times.length : null,
    median,
    successRate: samples.length + failures.length ? (samples.length / (samples.length + failures.length)) * 100 : 0,
    samples,
    statuses: samples.reduce((acc, sample) => {
      acc[sample.status] = (acc[sample.status] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
