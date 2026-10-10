const { mongoose } = require('../../db');
const { Schema } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, required: true });

const Post = mongoose.models.Post || mongoose.model('Post', new Schema({
  author: { ...ref('User'), index: true },
  text: { type: String, required: true, maxlength: 280 },
  media: [String],
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
}, { timestamps: true }).index({ createdAt: -1 }));

const Comment = mongoose.models.Comment || mongoose.model('Comment', new Schema({
  post: { ...ref('Post'), index: true }, author: ref('User'), text: { type: String, required: true, maxlength: 280 },
}, { timestamps: true }));

const Like = mongoose.models.Like || mongoose.model('Like',
  new Schema({ user: ref('User'), post: ref('Post') }, { timestamps: true }).index({ user: 1, post: 1 }, { unique: true }));

const Follow = mongoose.models.Follow || mongoose.model('Follow',
  new Schema({ follower: ref('User'), following: ref('User') }, { timestamps: true }).index({ follower: 1, following: 1 }, { unique: true }));

module.exports = { Post, Comment, Like, Follow };
