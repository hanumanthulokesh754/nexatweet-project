const httpError = (status, message, details) => Object.assign(new Error(message), { status, details });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function errorHandler(err, req, res, next) { // eslint-disable-line
  if (err.code === 11000) err = httpError(409, 'Duplicate value');
  if (err.name === 'CastError') err = httpError(400, 'Invalid id');
  if (err.code === 'LIMIT_FILE_SIZE') err = httpError(413, 'File too large');
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
module.exports = { httpError, wrap, errorHandler };
