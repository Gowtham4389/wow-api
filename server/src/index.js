// Must stay first so the .env file is applied before config is evaluated.
import './config/loadEnv.js';

import process from 'node:process';
import { createApp } from './app.js';
import { config } from './config/index.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[api-inspector] server listening on http://localhost:${config.port} (${config.nodeEnv})`);
  console.log(`[api-inspector] allowed client origins: ${config.clientOrigins.join(', ')}`);
  if (config.allowPrivateNetwork) {
    console.warn('[api-inspector] WARNING: ALLOW_PRIVATE_NETWORK is on. Never use this in production.');
  }
});

// Requests are bounded by their own timeout; keep the socket margin above it.
server.headersTimeout = config.requestTimeout + 15_000;
server.requestTimeout = config.requestTimeout + 30_000;

function shutdown(signal) {
  console.log(`[api-inspector] ${signal} received, shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
