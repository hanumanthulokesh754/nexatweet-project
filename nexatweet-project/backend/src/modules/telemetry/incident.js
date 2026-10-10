const { mongoose } = require('../../db');
const health = require('./health');
const rca = require('./rca');
const t = require('./index');
const chaos = require('../../resilience/chaos');

const Incident = mongoose.models.Incident || mongoose.model('Incident', new mongoose.Schema({
  component: { type: String, index: true },
  severity: { type: String, enum: ['degraded', 'down'] },
  status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
  snapshot: Object, rca: Object, resolvedAt: Date,
}, { timestamps: true }));

function init(bus) {
  health.emitter.on('change', async ({ component, to, snapshot }) => {
    try {
      const open = await Incident.findOne({ component, status: 'open' });
      if (to === 'healthy') {
        if (!open) return;
        open.status = 'resolved'; open.resolvedAt = new Date(); await open.save();
        return bus.publish('incident.resolved', { incidentId: open.id, component });
      }
      if (to !== 'degraded' && to !== 'down') return;

      const deps = Object.fromEntries(Object.entries(health.snapshot()).map(([k, v]) => [k, v.status]));
      const analysis = rca.analyze({ component, snapshot, samples: t.window(null, 120_000), chaos: chaos.getState(), deps });
      if (open) { open.severity = to; open.rca = analysis; open.snapshot = snapshot; await open.save(); return; }
      const inc = await Incident.create({ component, severity: to, snapshot, rca: analysis });
      bus.publish('incident.opened', { incidentId: inc.id, component, severity: to, cause: analysis.cause });
    } catch (e) { console.error('[incident]', e.message); }
  });
}

module.exports = { init, Incident };
