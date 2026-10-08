import { Buffer } from 'node:buffer';
import { config } from '../config/index.js';
import { badRequest } from '../utils/errors.js';
import { sanitizeRequestHeaders } from '../utils/headers.js';
import { parseTargetUrl } from '../utils/ssrf.js';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Validates and normalises the proxy payload before it reaches the controller.
 * Attaches the result as `req.proxyRequest`.
 */
export function validateProxyRequest(req, _res, next) {
  try {
    const payload = req.body ?? {};
    const method = String(payload.method ?? 'GET').toUpperCase();

    if (!ALLOWED_METHODS.has(method)) {
      throw badRequest(`"${payload.method}" is not a supported HTTP method.`, 'invalid_method');
    }

    const url = parseTargetUrl(payload.url);
    const { headers, dropped } = sanitizeRequestHeaders(payload.headers);

    let body = null;
    if (payload.body !== undefined && payload.body !== null && payload.body !== '') {
      if (typeof payload.body !== 'string') {
        throw badRequest('The request body must be sent as a string.', 'invalid_body');
      }
      const encoding = payload.bodyEncoding === 'base64' ? 'base64' : 'utf8';
      body = Buffer.from(payload.body, encoding);
      if (body.length > config.maxRequestSize) {
        throw badRequest('The request body exceeds the configured size limit.', 'body_too_large');
      }
    }

    const timeout = Number.isFinite(payload.timeout)
      ? Math.min(Math.max(Math.trunc(payload.timeout), 1000), config.requestTimeout)
      : config.requestTimeout;

    req.proxyRequest = {
      method,
      url: url.toString(),
      headers,
      droppedHeaders: dropped,
      body,
      timeout,
    };
    next();
  } catch (error) {
    next(error);
  }
}
