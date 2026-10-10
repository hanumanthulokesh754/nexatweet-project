const { mongoose, getRedis } = require('../db');
const cfg = require('../config');
const bus = require('../events/bus');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, { retries = 3, baseMs = 100 } = {}) {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e) { if (i >= retries) throw e; await sleep(baseMs * 2 ** i + Math.random() * baseMs); }
  }
}

// Self-healing watchdog: reconnect dependencies that dropped.
function startWatchdog(intervalMs = 15_000) {
  const t = setInterval(async () => {
    if (mongoose.connection.readyState === 0) {
      bus.publish('recovery.attempt', { target: 'mongo' });
      mongoose.connect(cfg.mongoUri, { serverSelectionTimeoutMS: 5000 }).catch(() => {});
    }
    const r = getRedis();
    if (r.status === 'end' || r.status === 'wait') { bus.publish('recovery.attempt', { target: 'redis' }); r.connect().catch(() => {}); }
  }, intervalMs);
  t.unref();
}

function installProcessGuards(server) {
  process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
  const shutdown = async (sig) => {
    console.log(`[${sig}] shutting down`);
    server.close(async () => { await mongoose.disconnect().catch(() => {}); getRedis().disconnect(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
}

module.exports = { retry, sleep, startWatchdog, installProcessGuards };
