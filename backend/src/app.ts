import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';

import { config } from './config';
import { logger } from './lib/logger';
import { validateTelegramAuth, errorHandler } from './middleware/auth.middleware';
import { gramJsPool } from './lib/gramjs-pool';
import { initBroadcastWorker, setBroadcastSocketIO } from './workers/broadcast.worker';
import { dispatchMessageToSpy } from './services/spy.service';
import { initScraperWorker, setScraperSocketIO } from './workers/scraper.worker';
import { initSpyWorker } from './workers/spy.worker';
import { setupSocketHandlers, emitNewMessage } from './socket/handlers';

// Routes
import accountRoutes from './routes/account.routes';
import userRoutes from './routes/user.routes';
import groupRoutes from './routes/group.routes';
import categoryRoutes from './routes/category.routes';
import broadcastRoutes from './routes/broadcast.routes';
import mediaRoutes from './routes/media.routes';
import dashboardRoutes from './routes/dashboard.routes';
import spyRoutes from './routes/spy.routes';
import scraperRoutes from './routes/scraper.routes';
import searchRoutes from './routes/search.routes';

// ──────────────────────────────────────────
// Express App Setup
// ──────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Telegram Web App compatibility
}));
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ──────────────────────────────────────────
// Socket.IO Setup
// ──────────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
});

setupSocketHandlers(io);
setBroadcastSocketIO(io);
setScraperSocketIO(io);

// ──────────────────────────────────────────
// Health Check (no auth required)
// ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ──────────────────────────────────────────
// Auth Middleware (applied to all /api routes)
// ──────────────────────────────────────────
app.use('/api', validateTelegramAuth);

// ──────────────────────────────────────────
// API Routes
// ──────────────────────────────────────────
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/spy', spyRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/search', searchRoutes);

// ──────────────────────────────────────────
// Error Handler
// ──────────────────────────────────────────
app.use(errorHandler);

// ──────────────────────────────────────────
// Startup
// ──────────────────────────────────────────
async function startServer() {
  try {
    // 1. Initialize the workers
    initBroadcastWorker();
    initScraperWorker();
    initSpyWorker();

    // 2. Connect all saved userbot accounts
    await gramJsPool.connectAll();

    // 3. Register message handler for all accounts
    gramJsPool.onNewMessage((accountId, event) => {
      const message = event.message;
      if (message) {
        emitNewMessage(io, accountId, {
          chatId: message.chatId?.toString() || '',
          text: message.text?.substring(0, 200),
          date: message.date || 0,
          isGroup: message.isGroup || false,
        });

        // Add message to Spy Pipeline for LLM analysis
        dispatchMessageToSpy(message as any);
      }
    });

    // 4. Start listening
    server.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(
        `🔐 Whitelisted users: ${config.whitelistedUserIds.length}`
      );
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ──────────────────────────────────────────
// Graceful Shutdown
// ──────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Disconnect all userbot accounts
  await gramJsPool.disconnectAll();

  // Close the HTTP server
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ──────────────────────────────────────────
// Keep-Alive Ping (Render Free Tier)
// ──────────────────────────────────────────
function startKeepAlive() {
  const pingInterval = 14 * 60 * 1000; // 14 minutes
  const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${config.port}`;
  
  setInterval(() => {
    http.get(`${url}/health`, (res) => {
      logger.info(`Keep-alive ping sent to ${url}/health - Status: ${res.statusCode}`);
    }).on('error', (err) => {
      logger.error(`Keep-alive ping failed: ${err.message}`);
    });
  }, pingInterval);
}

// Start the server
startServer().then(() => {
  if (process.env.NODE_ENV === 'production') {
    startKeepAlive();
  }
});

export { app, server, io };
