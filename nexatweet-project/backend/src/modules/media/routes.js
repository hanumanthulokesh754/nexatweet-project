const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cfg = require('../../config');
const { mongoose } = require('../../db');
const bus = require('../../events/bus');
const { auth } = require('../../gateway/auth');
const { wrap, httpError } = require('../../utils');

fs.mkdirSync(cfg.uploadDir, { recursive: true });
const Media = mongoose.models.Media || mongoose.model('Media', new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  filename: String, mimetype: String, size: Number, url: String,
}, { timestamps: true }));

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']);
const upload = multer({
  storage: multer.diskStorage({
    destination: cfg.uploadDir,
    filename: (_, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_, file, cb) => cb(ALLOWED.has(file.mimetype) ? null : httpError(415, 'Unsupported media type'), ALLOWED.has(file.mimetype)),
});

router.post('/', auth(), upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw httpError(400, 'file field is required');
  const media = await Media.create({
    owner: req.user.id, filename: req.file.filename, mimetype: req.file.mimetype, size: req.file.size,
    url: `/files/${req.file.filename}`,
  });
  bus.publish('media.uploaded', { mediaId: media.id, userId: req.user.id, size: media.size });
  res.status(201).json({ media });
}));

router.delete('/:id', auth(), wrap(async (req, res) => {
  const m = await Media.findById(req.params.id);
  if (!m) throw httpError(404, 'Not found');
  if (String(m.owner) !== req.user.id && req.user.role !== 'admin') throw httpError(403, 'Forbidden');
  await fs.promises.unlink(path.join(cfg.uploadDir, m.filename)).catch(() => {});
  await m.deleteOne();
  res.status(204).end();
}));

module.exports = router;
