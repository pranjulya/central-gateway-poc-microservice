import { createProxyMiddleware } from 'http-proxy-middleware';

const DEFAULT_PROXY_TIMEOUT_MS = Number.parseInt(process.env.GATEWAY_PROXY_TIMEOUT || '10000', 10);

function pathRewriter(prefix) {
  const normalized = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return (path = '/') => {
    const value = path || '/';
    if (value === '/' || value.length === 0) {
      return normalized;
    }

    if (value.startsWith(normalized)) {
      return value;
    }

    if (value.startsWith('/')) {
      return `${normalized}${value}`;
    }

    return `${normalized}/${value}`;
  };
}

function proxyErrorHandler(serviceName) {
  return (err, req, res) => {
    console.error(`${serviceName} proxy error`, {
      message: err.message,
      requestId: req.requestId,
    });

    if (res.headersSent) {
      res.end();
      return;
    }

    res.status(502).json({
      error: `${serviceName} unavailable`,
      requestId: req.requestId,
    });
  };
}

function forwardRequestBody(proxyReq, req) {
  if (!req.body || Object.keys(req.body).length === 0) {
    return;
  }

  const method = req.method?.toUpperCase();
  if (!method || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return;
  }

  const bodyData = JSON.stringify(req.body);
  proxyReq.setHeader('Content-Type', 'application/json');
  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
}

function createServiceProxy({ route, target, serviceName, proxyTimeout = DEFAULT_PROXY_TIMEOUT_MS }) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout,
    pathRewrite: pathRewriter(route),
    onProxyReq: (proxyReq, req) => {
      if (req.requestId) {
        proxyReq.setHeader('X-Request-ID', req.requestId);
        proxyReq.setHeader('X-Correlation-ID', req.requestId);
      }
      forwardRequestBody(proxyReq, req);
    },
    onProxyRes: (_proxyRes, req, res) => {
      if (req.requestId) {
        res.setHeader('X-Request-ID', req.requestId);
        res.setHeader('X-Correlation-ID', req.requestId);
      }
    },
    onError: proxyErrorHandler(serviceName),
    logProvider: () => console,
  });
}

export function mountServiceProxies(app, options = {}) {
  const {
    userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:4001',
    vpnServiceUrl = process.env.VPN_SERVICE_URL || 'http://localhost:4002',
    proxyTimeout,
    authMiddleware,
  } = options;

  const services = [
    {
      route: '/users',
      target: userServiceUrl,
      name: 'user-service',
    },
    {
      route: '/vpn',
      target: vpnServiceUrl,
      name: 'vpn-service',
    },
  ];

  services.forEach(({ route, target, name }) => {
    if (!target) {
      return;
    }

    const proxyMiddleware = createServiceProxy({
      route,
      target,
      serviceName: name,
      proxyTimeout,
    });

    if (authMiddleware) {
      app.use(route, authMiddleware, proxyMiddleware);
    } else {
      app.use(route, proxyMiddleware);
    }
  });
}
