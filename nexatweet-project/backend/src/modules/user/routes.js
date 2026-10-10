const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('./model');
const bus = require('../../events/bus');
const cfg = require('../../config');
const { sign, auth } = require('../../gateway/auth');
const validate = require('../../gateway/validate');
const { authLimiter } = require('../../gateway/rateLimit');
const { wrap, httpError } = require('../../utils');

const registerSchema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string() });
const profileSchema = z.object({
  displayName: z.string().max(50).optional(), bio: z.string().max(160).optional(), avatarUrl: z.string().max(300).optional(),
});

router.post('/register', authLimiter(), validate(registerSchema), wrap(async (req, res) => {
  const { username, email, password } = req.body;
  const user = await User.create({
    username, email, passwordHash: await bcrypt.hash(password, 10),
    role: cfg.adminEmail && email.toLowerCase() === cfg.adminEmail.toLowerCase() ? 'admin' : 'user',
  });
  bus.publish('user.registered', { userId: user.id });
  res.status(201).json({ user, token: sign(user) });
}));

router.post('/login', authLimiter(), validate(loginSchema), wrap(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw httpError(401, 'Invalid credentials');
  bus.publish('user.logged_in', { userId: user.id });
  res.json({ user, token: sign(user) });
}));

router.get('/me', auth(), wrap(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw httpError(404, 'User not found');
  res.json({ user });
}));

router.patch('/me', auth(), validate(profileSchema), wrap(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, req.body, { new: true });
  res.json({ user });
}));

router.get('/:username', wrap(async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!user) throw httpError(404, 'User not found');
  const { email, ...pub } = user.toJSON();
  res.json({ user: pub });
}));

module.exports = router;
