import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';

export function notFound(req, res) {
  res.status(404).json({
    error: { code: 'not_found', message: `No route matches ${req.method} ${req.path}.` },
  });
}

/**
 * Single place where errors become responses. Only AppError messages reach the
 * client; everything else is reported generically so internals stay private.
 */
export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;

  if (error instanceof AppError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  // Body parser errors (malformed JSON, payload too large).
  if (error?.type === 'entity.too.large') {
    res.status(413).json({
      error: { code: 'payload_too_large', message: 'The request payload is too large.' },
    });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: 'invalid_json', message: 'The request body is not valid JSON.' },
    });
    return;
  }

  if (!config.isProduction) {
    console.error('[api-inspector] unhandled error:', error);
  } else {
    console.error('[api-inspector] unhandled error:', error?.message);
  }
  res.status(500).json({
    error: { code: 'internal_error', message: 'The request could not be completed.' },
  });
}
