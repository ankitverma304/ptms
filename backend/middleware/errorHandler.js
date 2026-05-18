const logger = require('../utils/logger');

// Simple app error creator used to throw HTTP-aware errors in controllers
const appError = (message, status = 500) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

// Wrapper for async route handlers to forward errors to the error handler
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const errorHandler = (err, req, res, _next) => {
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'Duplicate entry — record already exists.' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ success: false, message: 'Referenced record does not exist.' });
  }

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler, asyncHandler, appError };
