import { Router } from 'express';
import proxyRoutes from './proxyRoutes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
});

router.use('/proxy', proxyRoutes);

export default router;
