import process from 'node:process';

function int(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function bool(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function list(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

export const config = {
  nodeEnv,
  isProduction,
  port: int(process.env.PORT, 5274, { min: 1, max: 65535 }),
  clientOrigins: list(process.env.CLIENT_URL).length
    ? list(process.env.CLIENT_URL)
    : ['http://localhost:5273', 'http://127.0.0.1:5273'],
  requestTimeout: int(process.env.REQUEST_TIMEOUT, 30_000, { min: 1000, max: 120_000 }),
  maxResponseSize: int(process.env.MAX_RESPONSE_SIZE, 10 * 1024 * 1024, {
    min: 1024,
    max: 64 * 1024 * 1024,
  }),
  maxRequestSize: int(process.env.MAX_REQUEST_SIZE, 2 * 1024 * 1024, {
    min: 1024,
    max: 32 * 1024 * 1024,
  }),
  maxRedirects: int(process.env.MAX_REDIRECTS, 5, { min: 0, max: 10 }),
  rateLimitWindowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 60_000, { min: 1000 }),
  rateLimitMax: int(process.env.RATE_LIMIT_MAX, 120, { min: 1 }),
  // Escape hatch for local development only; ignored when NODE_ENV=production.
  allowPrivateNetwork: !isProduction && bool(process.env.ALLOW_PRIVATE_NETWORK, false),
  serveClient: bool(process.env.SERVE_CLIENT, false),
};

export default config;
