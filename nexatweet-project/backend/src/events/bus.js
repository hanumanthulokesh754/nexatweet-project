const { EventEmitter } = require('events');
const crypto = require('crypto');

class Bus extends EventEmitter {
  publish(type, payload = {}) {
    const evt = { id: crypto.randomUUID(), type, ts: Date.now(), payload };
    setImmediate(() => { this.emit(type, evt); this.emit('*', evt); });
    return evt;
  }
  // A failing subscriber never affects publishers or other subscribers.
  subscribe(type, fn) {
    this.on(type, (evt) => {
      Promise.resolve().then(() => fn(evt)).catch((err) => this.emit('subscriber.error', { type, err }));
    });
  }
}
const bus = new Bus();
bus.setMaxListeners(50);
module.exports = bus;
module.exports.Bus = Bus;
