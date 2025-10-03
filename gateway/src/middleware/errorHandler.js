export default function errorHandler() {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const exposeMessage = status < 500 && err.message ? err.message : 'Internal Server Error';
    const responseBody = {
      error: exposeMessage,
      requestId: req.requestId,
    };

    if (err.details) {
      responseBody.details = err.details;
    }

    if (process.env.NODE_ENV !== 'production' && err.stack) {
      responseBody.stack = err.stack;
    }

    if (status >= 500) {
      console.error('Gateway error', { status, requestId: req.requestId, message: err.message, stack: err.stack });
    }

    res.status(status).json(responseBody);
  };
}
