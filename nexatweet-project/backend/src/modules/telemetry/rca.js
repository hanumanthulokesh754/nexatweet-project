// Rule-based Root Cause Analysis. Pure function: easy to test, no I/O.
function analyze({ component, snapshot = {}, samples = [], chaos = {}, deps = {} }) {
  const evidence = [];
  const suggestions = [];
  let cause = 'Unknown - insufficient signal';
  let confidence = 0.3;

  const failing = samples.filter((s) => s.kind === 'http' && !s.ok);
  const byRoute = failing.reduce((m, s) => ((m[s.name] = (m[s.name] || 0) + 1), m), {});
  const [topRoute, topCount] = Object.entries(byRoute).sort((a, b) => b[1] - a[1])[0] || [];

  if (chaos.active) {
    cause = 'Injected fault: chaos experiment is active';
    confidence = 0.95;
    evidence.push(`chaos: latency=${chaos.latencyMs}ms errorRate=${chaos.errorRate}`);
    suggestions.push('Stop the experiment via DELETE /api/resilience/chaos');
  } else if (component === 'http' && (deps.mongo === 'down' || deps.mongo === 'degraded')) {
    cause = `Upstream dependency issue: MongoDB is ${deps.mongo}`;
    confidence = 0.85;
    evidence.push(`mongo status=${deps.mongo}`);
    suggestions.push('Check MongoDB connectivity, primary election and connection pool');
  } else if (component === 'http' && deps.redis === 'down' && snapshot.p95 > 1500) {
    cause = 'Cache layer down causing slow fallbacks to MongoDB';
    confidence = 0.7;
    evidence.push('redis status=down', `http p95=${snapshot.p95}ms`);
    suggestions.push('Restore Redis; feeds fall back to direct DB queries');
  } else if (component === 'http' && topRoute && topCount / Math.max(failing.length, 1) > 0.6) {
    cause = `Errors concentrated on ${topRoute}`;
    confidence = 0.65;
    evidence.push(`${topCount}/${failing.length} failing requests hit ${topRoute}`);
    suggestions.push('Inspect recent deploys and handler logs for that route');
  } else if (component === 'mongo' || component === 'redis') {
    cause = `${component} unreachable or responding slowly`;
    confidence = 0.75;
    evidence.push(`errorRate=${snapshot.errorRate} p95=${snapshot.p95}ms`);
    suggestions.push(`Verify ${component} host, credentials and network; the watchdog is retrying automatically`);
  } else if (snapshot.p95 > 1500) {
    cause = 'Latency regression without a clear failing dependency';
    confidence = 0.5;
    evidence.push(`p95=${snapshot.p95}ms`);
    suggestions.push('Check CPU/event-loop lag and slow queries');
  }
  return { cause, confidence, evidence, suggestions, analyzedAt: new Date().toISOString() };
}
module.exports = { analyze };
