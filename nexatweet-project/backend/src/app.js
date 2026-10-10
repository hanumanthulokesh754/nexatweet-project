const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cfg = require('./config');
const { limiter } = require('./gateway/rateLimit');
const telemetry = require('./modules/telemetry');
const chaos = require('./resilience/chaos');
const health = require('./modules/telemetry/health');
const { errorHandler } = require('./utils');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// ===== API GATEWAY: security, CORS, rate limit, telemetry, chaos hook =====
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || cfg.corsOrigins.includes(origin) || cfg.corsOrigins.includes('*')),
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(telemetry.middleware);
app.get('/health', (req, res) => res.json({ status: 'ok', overall: health.overall() }));
app.use(chaos.middleware);
app.use('/api', limiter());

// ===== Domain services =====
app.use('/api/users', require('./modules/user/routes'));
app.use('/api/social', require('./modules/social/routes'));
app.use('/api/media', require('./modules/media/routes'));
app.use('/api/notifications', require('./modules/notify').router);
app.use('/api/analytics', require('./modules/analytics').router);
app.use('/api/telemetry', require('./modules/telemetry/routes'));
app.use('/api/resilience', chaos.router);
app.use('/files', express.static(cfg.uploadDir, { maxAge: '1d', index: false }));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);
module.exports = app;
