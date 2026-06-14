import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Telegram Bot
  botToken: process.env.BOT_TOKEN!,
  mediaChannelId: process.env.MEDIA_CHANNEL_ID!,

  // Telegram MTProto
  telegramApiId: parseInt(process.env.TELEGRAM_API_ID || '0', 10),
  telegramApiHash: process.env.TELEGRAM_API_HASH || '',

  // LLM Integration
  groqApiKey: process.env.GROQ_API_KEY || '',

  // Security
  encryptionMasterKey: process.env.ENCRYPTION_MASTER_KEY!,
  whitelistedUserIds: (process.env.WHITELISTED_USER_IDS || '')
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id)),

  // Broadcast defaults
  broadcast: {
    minSafeDelayMs: 5000,
    maxJitterMs: 2000,
    defaultDelayMs: 5000,
    defaultJitterMs: 1000,
  },
} as const;

// Validate critical environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'BOT_TOKEN',
  'TELEGRAM_API_ID',
  'TELEGRAM_API_HASH',
  'ENCRYPTION_MASTER_KEY',
  'GROQ_API_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  Warning: Missing environment variable ${envVar}`);
  }
}
