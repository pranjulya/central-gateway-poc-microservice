import { Router } from 'express';
import { nextIp, peekNextIp } from './ip.js';

const router = Router();

router.get('/vpn/next', (req, res) => {
  const ip = nextIp();
  res.json({
    data: {
      ip,
      assignedAt: new Date().toISOString(),
    },
    requestId: req.requestId,
  });
});

router.get('/vpn/preview', (req, res) => {
  res.json({
    data: {
      ip: peekNextIp(),
    },
    requestId: req.requestId,
  });
});

export default router;
