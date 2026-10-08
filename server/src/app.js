import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.isProduction ? 1 : false);

  // Only the configured frontend origins may call this API.
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and non-browser clients (curl, tests) send no Origin header.
        if (!origin) return callback(null, true);
        if (config.clientOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      maxAge: 86_400,
    }),
  );

  app.use(express.json({ limit: config.maxRequestSize + 1024 * 64 }));

  // Conservative baseline headers; the API itself returns JSON only.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    next();
  });

  app.use('/api', routes);

  // Optionally serve the built SPA from the same process in production.
  if (config.serveClient) {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
