const router = require('express').Router();
const { mongoose } = require('../../db');
const { auth, requireAdmin } = require('../../gateway/auth');
const { wrap } = require('../../utils');

const Metric = mongoose.models.Metric || mongoose.model('Metric',
  new mongoose.Schema({ day: String, type: String, count: { type: Number, default: 0 } }).index({ day: 1, type: 1 }, { unique: true }));

const TRACKED = /^(user|post|comment|media)\./;
function init(bus) {
  bus.subscribe('*', (e) => {
    if (!TRACKED.test(e.type)) return;
    const day = new Date(e.ts).toISOString().slice(0, 10);
    return Metric.updateOne({ day, type: e.type }, { $inc: { count: 1 } }, { upsert: true });
  });
}

router.get('/summary', auth(), requireAdmin, wrap(async (req, res) => {
  const days = Math.min(+req.query.days || 7, 90);
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const rows = await Metric.aggregate([
    { $match: { day: { $gte: since } } },
    { $group: { _id: '$type', total: { $sum: '$count' } } },
    { $sort: { total: -1 } },
  ]);
  res.json({ since, totals: Object.fromEntries(rows.map((r) => [r._id, r.total])) });
}));

module.exports = { init, router };
