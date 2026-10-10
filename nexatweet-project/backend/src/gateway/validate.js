const { httpError } = require('../utils');
module.exports = (schema, part = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[part]);
  if (!r.success) return next(httpError(400, 'Validation failed', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
  req[part] = r.data; next();
};
