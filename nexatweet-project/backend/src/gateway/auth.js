const jwt = require('jsonwebtoken');
const cfg = require('../config');
const { httpError } = require('../utils');

const sign = (u) => jwt.sign({ id: u.id, role: u.role }, cfg.jwtSecret, { expiresIn: '7d' });

function auth(required = true) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return required ? next(httpError(401, 'Missing token')) : next();
    try { req.user = jwt.verify(token, cfg.jwtSecret); next(); }
    catch { next(httpError(401, 'Invalid or expired token')); }
  };
}
const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : next(httpError(403, 'Admin only'));

module.exports = { sign, auth, requireAdmin };
