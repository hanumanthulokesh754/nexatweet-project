const router = require('express').Router();
const { z } = require('zod');
const cfg = require('../config');
const bus = require('../events/bus');
const { auth, requireAdmin } = require('../gateway/auth');
const validate = require('../gateway/validate');
const { httpError } = require('../utils');
const { sleep } = require('./recovery');

let state = { active: false, latencyMs: 0, errorRate: 0, expiresAt: 0 };
const getState = () => {
  if (state.active && Date.now() > state.expiresAt) state = { active: false, latencyMs: 0, errorRate: 0, expiresAt: 0 };
  return { ...state };
};

async function middleware(req, res, next) {
  if (!cfg.chaosEnabled || req.path.startsWith('/api/resilience') || req.path === '/health') return next();
  const s = getState();
  if (!s.active) return next();
  if (s.latencyMs) await sleep(s.latencyMs);
  if (Math.random() < s.errorRate) return next(httpError(500, 'Chaos: injected failure'));
  next();
}

const schema = z.object({
  latencyMs: z.number().min(0).max(10_000).default(0),
  errorRate: z.number().min(0).max(1).default(0),
  durationSec: z.number().min(1).max(600).default(60),
});

router.use(auth(), requireAdmin);
router.get('/chaos', (req, res) => res.json({ enabled: cfg.chaosEnabled, ...getState() }));
router.post('/chaos', validate(schema), (req, res, next) => {
  if (!cfg.chaosEnabled) return next(httpError(403, 'Set CHAOS_ENABLED=true to run experiments'));
  const { latencyMs, errorRate, durationSec } = req.body;
  state = { active: true, latencyMs, errorRate, expiresAt: Date.now() + durationSec * 1000 };
  bus.publish('chaos.started', { latencyMs, errorRate, durationSec });
  res.json(getState());
});
router.delete('/chaos', (req, res) => {
  state = { active: false, latencyMs: 0, errorRate: 0, expiresAt: 0 };
  bus.publish('chaos.stopped', {});
  res.json(getState());
});

module.exports = { middleware, router, getState };
