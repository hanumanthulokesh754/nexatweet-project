const router = require('express').Router();
const { mongoose } = require('../../db');
const { auth } = require('../../gateway/auth');
const { wrap } = require('../../utils');

const Notification = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, index: true },
  type: String, actor: mongoose.Schema.Types.ObjectId, ref: String, read: { type: Boolean, default: false },
}, { timestamps: true }));

function init(bus) {
  const notify = (type) => (e) => {
    const { ownerId, actorId, postId } = e.payload;
    if (!ownerId || ownerId === actorId) return; // don't notify yourself
    return Notification.create({ user: ownerId, type, actor: actorId, ref: postId });
  };
  bus.subscribe('post.liked', notify('like'));
  bus.subscribe('comment.created', notify('comment'));
  bus.subscribe('user.followed', notify('follow'));
}

router.get('/', auth(), wrap(async (req, res) =>
  res.json({ notifications: await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50) })));
router.post('/read-all', auth(), wrap(async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ ok: true });
}));

module.exports = { init, router };
