import { Router } from 'express';
import { handleProxyInfo, handleProxyRequest } from '../controllers/proxyController.js';
import { validateProxyRequest } from '../middleware/validateProxyRequest.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const router = Router();
const limiter = createRateLimiter();

router.get('/info', handleProxyInfo);
router.post('/', limiter, validateProxyRequest, handleProxyRequest);

export default router;
