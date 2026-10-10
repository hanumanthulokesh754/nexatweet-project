require('dotenv').config();
module.exports = {
  port: +process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nexatweet',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  adminEmail: process.env.ADMIN_EMAIL || '',
  chaosEnabled: process.env.CHAOS_ENABLED === 'true',
  nexoraUrl: process.env.NEXORA_URL || '',
  nexoraKey: process.env.NEXORA_API_KEY || '',
};
