import { randomUUID } from 'node:crypto';

const HEADER_KEYS = ['x-request-id', 'x-correlation-id'];

function extractIncomingId(req) {
  for (const key of HEADER_KEYS) {
    const value = req.header(key);
    if (!value) continue;
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  }
  return null;
}

export default function requestId() {
  return (req, res, next) => {
    const incomingId = extractIncomingId(req);
    const correlationId = incomingId || randomUUID();

    req.requestId = correlationId;
    res.locals.requestId = correlationId;

    res.setHeader('X-Request-ID', correlationId);
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  };
}
