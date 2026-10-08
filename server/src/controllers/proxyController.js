import { config } from '../config/index.js';
import { executeRequest, isTextualContentType } from '../services/httpClient.js';

/** Log one line per proxied request, never including credentials. */
function logRequest({ method, url, status, ms }) {
  let safeUrl = url;
  try {
    const parsed = new URL(url);
    // Query strings can carry API keys, so only the path is logged.
    safeUrl = `${parsed.origin}${parsed.pathname}`;
  } catch {
    safeUrl = '[unparsable url]';
  }
  console.log(`[proxy] ${method} ${safeUrl} -> ${status} (${ms} ms)`);
}

export async function handleProxyRequest(req, res, next) {
  const { method, url, headers, body, timeout, droppedHeaders } = req.proxyRequest;

  // Propagate real client disconnects so we stop waiting on the upstream
  // server. `res` close fires once per request: if the response never finished
  // writing, the browser went away (or the user pressed Cancel).
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', onClose);

  try {
    const result = await executeRequest({
      method,
      url,
      headers,
      body,
      timeout,
      maxSize: config.maxResponseSize,
      maxRedirects: config.maxRedirects,
      signal: controller.signal,
    });

    const contentType = result.headers['content-type'] ?? '';
    const textual = isTextualContentType(contentType);

    logRequest({ method, url, status: result.status, ms: result.totalTime });

    res.json({
      status: result.status,
      statusText: result.statusText,
      httpVersion: result.httpVersion,
      headers: result.headers,
      body: textual ? result.buffer.toString('utf8') : result.buffer.toString('base64'),
      bodyEncoding: textual ? 'utf8' : 'base64',
      contentType,
      size: result.bytes,
      encodedSize: result.encodedBytes,
      contentEncoding: result.contentEncoding,
      truncated: result.truncated,
      maxResponseSize: config.maxResponseSize,
      time: result.totalTime,
      timing: result.timing,
      finalUrl: result.finalUrl,
      requestUrl: url,
      method: result.method,
      redirects: result.redirects,
      droppedHeaders,
      via: 'proxy',
    });
  } catch (error) {
    next(error);
  } finally {
    res.off('close', onClose);
  }
}

/** Exposes the limits the client needs to show accurate warnings. */
export function handleProxyInfo(_req, res) {
  res.json({
    maxResponseSize: config.maxResponseSize,
    maxRequestSize: config.maxRequestSize,
    requestTimeout: config.requestTimeout,
    maxRedirects: config.maxRedirects,
    rateLimit: { windowMs: config.rateLimitWindowMs, max: config.rateLimitMax },
    allowPrivateNetwork: config.allowPrivateNetwork,
  });
}
