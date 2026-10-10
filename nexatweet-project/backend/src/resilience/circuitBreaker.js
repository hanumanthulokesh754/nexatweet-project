class CircuitBreaker {
  constructor({ failureThreshold = 5, resetMs = 10_000 } = {}) {
    Object.assign(this, { failureThreshold, resetMs, state: 'closed', failures: 0, openedAt: 0 });
  }
  async exec(fn) {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.resetMs) throw new Error('circuit open');
      this.state = 'half-open';
    }
    try {
      const r = await fn();
      this.state = 'closed'; this.failures = 0;
      return r;
    } catch (e) {
      this.failures++;
      if (this.state === 'half-open' || this.failures >= this.failureThreshold) { this.state = 'open'; this.openedAt = Date.now(); }
      throw e;
    }
  }
}
module.exports = { CircuitBreaker };
