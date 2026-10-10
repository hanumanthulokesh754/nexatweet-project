const { EventEmitter } = require('events');
const { mongoose, getRedis } = require('../../db');
const bus = require('../../events/bus');
const t = require('./index');

const COMPONENTS = ['http', 'mongo', 'redis'];
const emitter = new EventEmitter();
const state = {};

async function timed(kind, fn) {
  const s = Date.now();
  try { await fn(); t.record({ kind, name: 'ping', ms: Date.now() - s, ok: true }); }
  catch { t.record({ kind, name: 'ping', ms: Date.now() - s, ok: false }); }
}

function evaluate(kind) {
  const w = t.window(kind);
  if (!w.length) return { status: 'unknown', n: 0 };
  const errorRate = w.filter((s) => !s.ok).length / w.length;
  const p95 = t.percentile(w.map((s) => s.ms), 95);
  const status = errorRate >= 0.5 ? 'down' : errorRate >= 0.1 || p95 > 1500 ? 'degraded' : 'healthy';
  return { status, errorRate: +errorRate.toFixed(3), p95: Math.round(p95), n: w.length };
}

async function tick() {
  await timed('mongo', () => mongoose.connection.db.admin().ping());
  await timed('redis', () => getRedis().ping());
  for (const c of COMPONENTS) {
    const r = evaluate(c);
    const prev = state[c]?.status || 'unknown';
    state[c] = { ...r, since: prev === r.status ? state[c].since : Date.now() };
    if (r.status !== prev && r.status !== 'unknown') {
      emitter.emit('change', { component: c, from: prev, to: r.status, snapshot: r });
      bus.publish('health.changed', { component: c, from: prev, to: r.status });
    }
  }
}

function start(intervalMs = 10_000) {
  tick().catch(() => {});
  setInterval(() => tick().catch(() => {}), intervalMs).unref();
}
const snapshot = () => ({ ...state });
const overall = () => {
  const s = Object.values(state).map((x) => x.status);
  return s.includes('down') ? 'down' : s.includes('degraded') ? 'degraded' : 'healthy';
};

module.exports = { start, snapshot, overall, evaluate, emitter, COMPONENTS };
