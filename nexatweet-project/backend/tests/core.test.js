const test = require('node:test');
const assert = require('node:assert');
const { CircuitBreaker } = require('../src/resilience/circuitBreaker');
const { analyze } = require('../src/modules/telemetry/rca');
const { Bus } = require('../src/events/bus');

test('circuit breaker opens after threshold, then half-opens and recovers', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 2, resetMs: 30 });
  const fail = () => Promise.reject(new Error('x'));
  await assert.rejects(cb.exec(fail)); await assert.rejects(cb.exec(fail));
  assert.strictEqual(cb.state, 'open');
  await assert.rejects(cb.exec(() => 1), /circuit open/);
  await new Promise((r) => setTimeout(r, 40));
  assert.strictEqual(await cb.exec(() => 'ok'), 'ok');
  assert.strictEqual(cb.state, 'closed');
});

test('RCA blames chaos when an experiment is active', () => {
  const r = analyze({ component: 'http', chaos: { active: true, errorRate: 0.5, latencyMs: 0 } });
  assert.match(r.cause, /chaos/i);
  assert.ok(r.confidence > 0.9);
});

test('RCA blames MongoDB when http is failing and mongo is down', () => {
  const r = analyze({ component: 'http', deps: { mongo: 'down' }, snapshot: { errorRate: 0.7 } });
  assert.match(r.cause, /MongoDB/);
});

test('bus isolates failing subscribers', async () => {
  const bus = new Bus(); let got = 0, errors = 0;
  bus.on('subscriber.error', () => errors++);
  bus.subscribe('a', () => { throw new Error('boom'); });
  bus.subscribe('a', () => { got++; });
  bus.publish('a');
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(got, 1); assert.strictEqual(errors, 1);
});
