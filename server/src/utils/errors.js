/**
 * Error carrying a client-safe message. Anything thrown that is not an
 * AppError is reported to the client as a generic failure so that internal
 * details (stack traces, file paths, host internals) never leak.
 */
export class AppError extends Error {
  constructor(message, { status = 400, code = 'bad_request', details } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, code = 'invalid_request', details) =>
  new AppError(message, { status: 400, code, details });

export const blocked = (message, code = 'blocked_target') =>
  new AppError(message, { status: 403, code });

export const upstream = (message, code = 'upstream_error') =>
  new AppError(message, { status: 502, code });
