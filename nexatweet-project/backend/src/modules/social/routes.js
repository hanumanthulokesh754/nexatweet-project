const router = require('express').Router();
const { z } = require('zod');
const { Post, Comment, Like, Follow } = require('./models');
const bus = require('../../events/bus');
const { cache } = require('../../db');
const { auth } = require('../../gateway/auth');
const validate = require('../../gateway/validate');
const { wrap, httpError } = require('../../utils');

const postSchema = z.object({
  text: z.string().min(1).max(280),
  media: z.array(z.string().startsWith('/files/')).max(4).optional(),
});
const commentSchema = z.object({ text: z.string().min(1).max(280) });

const getPost = async (id) => {
  const p = await Post.findById(id);
  if (!p) throw httpError(404, 'Post not found');
  return p;
};

// ---- Posts
router.post('/posts', auth(), validate(postSchema), wrap(async (req, res) => {
  const post = await Post.create({ author: req.user.id, ...req.body });
  bus.publish('post.created', { postId: post.id, userId: req.user.id });
  res.status(201).json({ post });
}));

router.get('/posts/:id', auth(false), wrap(async (req, res) => res.json({ post: await getPost(req.params.id) })));

router.delete('/posts/:id', auth(), wrap(async (req, res) => {
  const post = await getPost(req.params.id);
  if (String(post.author) !== req.user.id && req.user.role !== 'admin') throw httpError(403, 'Not your post');
  await Promise.all([post.deleteOne(), Comment.deleteMany({ post: post.id }), Like.deleteMany({ post: post.id })]);
  bus.publish('post.deleted', { postId: post.id, userId: req.user.id });
  res.status(204).end();
}));

// ---- Likes
router.post('/posts/:id/like', auth(), wrap(async (req, res) => {
  const post = await getPost(req.params.id);
  try { await Like.create({ user: req.user.id, post: post.id }); }
  catch (e) { if (e.code === 11000) return res.json({ liked: true, likesCount: post.likesCount }); throw e; }
  const updated = await Post.findByIdAndUpdate(post.id, { $inc: { likesCount: 1 } }, { new: true });
  bus.publish('post.liked', { postId: post.id, actorId: req.user.id, ownerId: String(post.author) });
  res.json({ liked: true, likesCount: updated.likesCount });
}));

router.delete('/posts/:id/like', auth(), wrap(async (req, res) => {
  const r = await Like.deleteOne({ user: req.user.id, post: req.params.id });
  if (r.deletedCount) await Post.updateOne({ _id: req.params.id }, { $inc: { likesCount: -1 } });
  res.json({ liked: false });
}));

// ---- Comments
router.post('/posts/:id/comments', auth(), validate(commentSchema), wrap(async (req, res) => {
  const post = await getPost(req.params.id);
  const comment = await Comment.create({ post: post.id, author: req.user.id, text: req.body.text });
  await Post.updateOne({ _id: post.id }, { $inc: { commentsCount: 1 } });
  bus.publish('comment.created', { postId: post.id, commentId: comment.id, actorId: req.user.id, ownerId: String(post.author) });
  res.status(201).json({ comment });
}));

router.get('/posts/:id/comments', wrap(async (req, res) => {
  res.json({ comments: await Comment.find({ post: req.params.id }).sort({ createdAt: 1 }).limit(100) });
}));

// ---- Follow graph
router.post('/follow/:userId', auth(), wrap(async (req, res) => {
  if (req.params.userId === req.user.id) throw httpError(400, 'Cannot follow yourself');
  try { await Follow.create({ follower: req.user.id, following: req.params.userId }); }
  catch (e) { if (e.code !== 11000) throw e; return res.json({ following: true }); }
  bus.publish('user.followed', { actorId: req.user.id, ownerId: req.params.userId });
  res.json({ following: true });
}));

router.delete('/follow/:userId', auth(), wrap(async (req, res) => {
  await Follow.deleteOne({ follower: req.user.id, following: req.params.userId });
  res.json({ following: false });
}));

// ---- Home feed (Redis-cached, short TTL)
router.get('/feed', auth(), wrap(async (req, res) => {
  const before = req.query.before ? new Date(req.query.before) : null;
  const key = `feed:${req.user.id}:${before ? before.getTime() : 0}`;
  const hit = await cache.get(key);
  if (hit) return res.json({ posts: hit, cached: true });

  const following = await Follow.find({ follower: req.user.id }).distinct('following');
  const q = { author: { $in: [...following, req.user.id] } };
  if (before) q.createdAt = { $lt: before };
  const posts = await Post.find(q).sort({ createdAt: -1 }).limit(20).populate('author', 'username displayName avatarUrl');
  await cache.set(key, posts, 15);
  res.json({ posts });
}));

module.exports = router;
