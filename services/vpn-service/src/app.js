import express from 'express';
import createError from 'http-errors';
import { randomUUID } from 'node:crypto';

import router from './routes.js';
import { peekNextIp } from './ip.js';

const PORT = Number.parseInt(process.env.PORT || '4002', 10);
const startedAt = new Date();

const app = express();
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware());

app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    startedAt,
    nextIp: peekNextIp(),
    requestId: req.requestId,
  });
});

app.use(router);

app.use((req, res, next) => {
  next(createError(404, 'Not Found'));
});

app.use(serviceErrorHandler());

app.listen(PORT, () => {
  console.log(`VPN service listening on port ${PORT}`);
});

function requestIdMiddleware() {
  return (req, res, next) => {
    const incoming = req.header('x-request-id') || req.header('x-correlation-id');
    const requestId = incoming || randomUUID();

    req.requestId = requestId;
    res.set('X-Request-ID', requestId);
    res.set('X-Correlation-ID', requestId);

    next();
  };
}

function serviceErrorHandler() {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = status < 500 && err.message ? err.message : 'Internal Server Error';
    res.status(status).json({
      error: message,
      requestId: req.requestId,
    });
    if (status >= 500) {
      console.error('VPN service error', { message: err.message, requestId: req.requestId });
    }
  };
}
