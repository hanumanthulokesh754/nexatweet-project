const cfg = require('./config');
const { connectMongo, getRedis } = require('./db');
const bus = require('./events/bus');
const { retry, startWatchdog, installProcessGuards } = require('./resilience/recovery');

(async () => {
  await retry(connectMongo, { retries: 5, baseMs: 500 });
  getRedis();

  // Event bus subscribers
  require('./modules/notify').init(bus);
  require('./modules/analytics').init(bus);
  require('./modules/telemetry').init(bus); // starts Health, Incident/RCA, Nexora adapter

  const app = require('./app');
  const server = app.listen(cfg.port, () => console.log(`[nexatweet] listening on :${cfg.port}`));
  startWatchdog();
  installProcessGuards(server);
})().catch((e) => { console.error('Fatal startup error:', e); process.exit(1); });
