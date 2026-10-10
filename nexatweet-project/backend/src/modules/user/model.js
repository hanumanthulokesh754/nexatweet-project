const { mongoose } = require('../../db');
const s = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String, maxlength: 50, default: '' },
  bio: { type: String, maxlength: 160, default: '' },
  avatarUrl: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });
s.set('toJSON', { transform: (_, o) => { o.id = o._id; delete o._id; delete o.__v; delete o.passwordHash; return o; } });
module.exports = mongoose.models.User || mongoose.model('User', s);
