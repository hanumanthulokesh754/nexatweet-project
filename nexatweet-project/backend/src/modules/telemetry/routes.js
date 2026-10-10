const router = require('express').Router();
const health = require('./health');
const nexora = require('./nexora');
const { Incident } = require('./incident');
const t = require('./index');
const { auth, requireAdmin } = require('../../gateway/auth');
const { wrap } = require('../../utils');

router.use(auth(), requireAdmin);
router.get('/health', (req, res) => res.json({ overall: health.overall(), components: health.snapshot() }));
router.get('/incidents', wrap(async (req, res) => {
  const q = req.query.status ? { status: req.query.status } : {};
  res.json({ incidents: await Incident.find(q).sort({ createdAt: -1 }).limit(50) });
}));
router.get('/incidents/:id/rca', wrap(async (req, res) => {
  const inc = await Incident.findById(req.params.id);
  res.status(inc ? 200 : 404).json(inc ? { component: inc.component, rca: inc.rca } : { error: 'Not found' });
}));
router.get('/nexora', (req, res) => res.json(nexora.status()));
router.get('/metrics', (req, res) => {
  const w = t.window('http');
  res.json({ requests: w.length, errors: w.filter((s) => !s.ok).length, p50: t.percentile(w.map((s) => s.ms), 50), p95: t.percentile(w.map((s) => s.ms), 95) });
});

module.exports = router;
