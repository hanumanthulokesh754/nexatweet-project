const mongoose = require('mongoose');
const Redis = require('ioredis');
const cfg = require('./config');

let redis;
async function connectMongo() {
  await mongoose.connect(cfg.mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('[mongo] connected');
}
function getRedis() {
  if (!redis) {
    redis = new Redis(cfg.redisUrl, {
      lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false,
      retryStrategy: (n) => Math.min(n * 300, 5000),
    });
    redis.on('error', () => {});
    redis.connect().catch(() => {});
  }
  return redis;
}
// Cache helpers never throw: Redis being down must not break requests.
const cache = {
  async get(key) { try { const v = await getRedis().get(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  async set(key, val, ttlSec = 30) { try { await getRedis().set(key, JSON.stringify(val), 'EX', ttlSec); } catch {} },
  async del(key) { try { await getRedis().del(key); } catch {} },
};
module.exports = { connectMongo, getRedis, cache, mongoose };
