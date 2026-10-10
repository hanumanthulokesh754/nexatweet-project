const rateLimit = require('express-rate-limit');
const make = (limit, windowMs = 60_000) =>
  rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests' } });
module.exports = { limiter: () => make(120), authLimiter: () => make(10, 15 * 60_000) };
