import express from 'express';
import createError from 'http-errors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import requestId from './middleware/requestId.js';
import errorHandler from './middleware/errorHandler.js';
import { mountServiceProxies } from './proxy.js';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const startedAt = new Date();

const app = express();
app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));
app.use(requestId());

const authMiddleware = buildAuthMiddleware();

app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    startedAt,
    requestId: req.requestId,
  });
});

app.get('/openapi', (req, res, next) => {
  try {
    const specPath = resolveRelative('../openapi.yaml');
    if (!fs.existsSync(specPath)) {
      throw createError(404, 'OpenAPI spec not found');
    }
    res.type('application/yaml').send(fs.readFileSync(specPath, 'utf8'));
  } catch (err) {
    next(err);
  }
});

mountServiceProxies(app, { authMiddleware });

app.use((req, res, next) => {
  next(createError(404, 'Not Found'));
});

app.use(errorHandler());

app.listen(PORT, () => {
  console.log(`Gateway listening on port ${PORT}`);
});

function resolveRelative(relativePath) {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(dirname, relativePath);
}

function buildAuthMiddleware() {
  const basicUser = process.env.GATEWAY_BASIC_AUTH_USER;
  const basicPassword = process.env.GATEWAY_BASIC_AUTH_PASSWORD;
  const bearerToken = process.env.GATEWAY_BEARER_TOKEN || process.env.GATEWAY_JWT_TOKEN;

  const hasBasic = Boolean(basicUser && basicPassword);
  const hasBearer = Boolean(bearerToken);

  if (!hasBasic && !hasBearer) {
    return null;
  }

  return (req, res, next) => {
    const header = req.header('authorization') || '';
    const parsed = parseAuthorization(header);

    const basicValid = hasBasic && parsed?.scheme === 'basic' && parsed.username === basicUser && parsed.password === basicPassword;
    const bearerValid = hasBearer && parsed?.scheme === 'bearer' && parsed.token === bearerToken;

    if ((hasBasic && basicValid) || (hasBearer && bearerValid)) {
      next();
      return;
    }

    const challenges = [];
    if (hasBasic) {
      challenges.push('Basic realm="gateway"');
    }
    if (hasBearer) {
      challenges.push('Bearer');
    }

    if (challenges.length > 0) {
      res.set('WWW-Authenticate', challenges.join(', '));
    }

    res.status(401).json({
      error: 'Unauthorized',
      requestId: req.requestId,
    });
  };
}

function parseAuthorization(headerValue) {
  if (!headerValue) {
    return null;
  }

  const [scheme, rawCredentials = ''] = headerValue.split(' ');
  if (!scheme) {
    return null;
  }

  if (scheme.toLowerCase() === 'basic') {
    try {
      const decoded = Buffer.from(rawCredentials, 'base64').toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex === -1) {
        return { scheme: 'basic' };
      }
      return {
        scheme: 'basic',
        username: decoded.slice(0, separatorIndex),
        password: decoded.slice(separatorIndex + 1),
      };
    } catch (err) {
      console.warn('Failed to decode basic auth credentials', err);
      return { scheme: 'basic' };
    }
  }

  if (scheme.toLowerCase() === 'bearer') {
    return {
      scheme: 'bearer',
      token: rawCredentials,
    };
  }

  return {
    scheme: scheme.toLowerCase(),
  };
}
