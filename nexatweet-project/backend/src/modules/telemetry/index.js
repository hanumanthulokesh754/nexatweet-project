const WINDOW_MS = 60_000;
const samples = []; // { ts, kind, name, ms, ok, status? }

function record(s) {
  samples.push({ ts: Date.now(), ...s });
  const cut = Date.now() - WINDOW_MS * 5;
  while (samples.length && samples[0].ts < cut) samples.shift();
  if (samples.length > 20_000) samples.splice(0, samples.length - 20_000);
}
const window = (kind, ms = WINDOW_MS) => {
  const cut = Date.now() - ms;
  return samples.filter((s) => s.ts >= cut && (!kind || s.kind === kind));
};
const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
};

function middleware(req, res, next) {
  const t0 = process.hrtime.bigint();
  res.on('finish', () => {
    record({
      kind: 'http', name: `${req.method} ${(req.baseUrl || '') + (req.route?.path || '') || 'unmatched'}`,
      ms: Number(process.hrtime.bigint() - t0) / 1e6, ok: res.statusCode < 500, status: res.statusCode,
    });
  });
  next();
}

// Start engines: Health, Incident (-> RCA) and the Nexora adapter.
function init(bus) {
  bus.subscribe('*', (e) => record({ kind: 'event', name: e.type, ms: 0, ok: true }));
  bus.on('subscriber.error', ({ type, err }) => record({ kind: 'event', name: `subscriber.error:${type}`, ms: 0, ok: false, error: err.message }));
  require('./health').start();
  require('./incident').init(bus);
  require('./nexora').init(bus);
}

module.exports = { record, window, percentile, middleware, init };
