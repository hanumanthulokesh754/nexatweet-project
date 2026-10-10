// Adapter that forwards incidents/health changes to the external Nexora platform.
// Endpoint contract (POST {NEXORA_URL}/ingest) is an assumption - adjust to Nexora's real API.
const cfg = require('../../config');
const { CircuitBreaker } = require('../../resilience/circuitBreaker');
const { retry } = require('../../resilience/recovery');

const MAX_QUEUE = 1000;
const queue = [];
const breaker = new CircuitBreaker({ failureThreshold: 3, resetMs: 15_000 });
const stats = { enabled: !!cfg.nexoraUrl, sent: 0, dropped: 0 };

function enqueue(item) {
  if (!stats.enabled) return;
  if (queue.length >= MAX_QUEUE) { queue.shift(); stats.dropped++; }
  queue.push(item);
}

async function flush() {
  if (!queue.length) return;
  const batch = queue.splice(0, 100);
  try {
    await breaker.exec(() => retry(async () => {
      const r = await fetch(`${cfg.nexoraUrl}/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.nexoraKey}` },
        body: JSON.stringify({ source: 'nexatweet', events: batch }),
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw new Error(`nexora responded ${r.status}`);
    }, { retries: 2 }));
    stats.sent += batch.length;
  } catch {
    queue.unshift(...batch); // keep for the next flush, bounded
    if (queue.length > MAX_QUEUE) { stats.dropped += queue.length - MAX_QUEUE; queue.length = MAX_QUEUE; }
  }
}

function init(bus) {
  ['incident.opened', 'incident.resolved', 'health.changed'].forEach((type) =>
    bus.subscribe(type, (e) => enqueue({ type: e.type, ts: e.ts, data: e.payload })));
  setInterval(flush, 5000).unref();
}
const status = () => ({ ...stats, queued: queue.length, breaker: breaker.state });

module.exports = { init, status, flush };
