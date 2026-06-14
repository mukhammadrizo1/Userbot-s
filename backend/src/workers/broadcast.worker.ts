import { Worker, Job } from 'bullmq';
import IORedis from 'bullmq/node_modules/ioredis';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { telegramService } from '../services/telegram.service';
import { logger } from '../lib/logger';
import { Server as SocketIOServer } from 'socket.io';

const prisma = new PrismaClient();

interface BroadcastJobData {
  broadcastJobId: string;
  accountId: string;
  targets: Array<{ id: string; telegramId: string; type: 'user' | 'group' }>;
  messageText?: string;
  parseMode?: string;
  mediaAssetId?: string;
  delayMs: number;
  jitterMs: number;
}

let io: SocketIOServer | null = null;

/**
 * Set the Socket.IO server reference so the worker can emit progress events.
 */
export function setBroadcastSocketIO(socketIO: SocketIOServer): void {
  io = socketIO;
}

/**
 * Emit progress update to connected frontend clients.
 */
function emitProgress(
  broadcastJobId: string,
  data: {
    sent: number;
    failed: number;
    skipped: number;
    total: number;
    currentTarget?: string;
    status: string;
  }
): void {
  if (io) {
    io.to(`broadcast:${broadcastJobId}`).emit('broadcast:progress', {
      jobId: broadcastJobId,
      ...data,
    });
  }
}

/**
 * Wait for a resume signal via Redis Pub/Sub.
 * This is used when a broadcast is paused — the worker subscribes and waits
 * until a RESUME or CANCEL signal is published.
 */
async function waitForResume(
  broadcastJobId: string,
  redis: IORedis
): Promise<'resume' | 'cancel'> {
  return new Promise((resolve) => {
    const subscriber = redis.duplicate();
    const channel = `broadcast:${broadcastJobId}:resume`;

    subscriber.subscribe(channel, () => {
      logger.info(`Worker waiting for resume signal on ${channel}`);
    });

    subscriber.on('message', (_ch: string, message: string) => {
      subscriber.unsubscribe(channel);
      subscriber.disconnect();
      resolve(message === 'cancel' ? 'cancel' : 'resume');
    });
  });
}

/**
 * Sleep utility with random jitter for human-like timing.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Initialize the broadcast worker.
 * This should be called once on server startup.
 */
export function initBroadcastWorker(): Worker {
  const redisConnection = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<BroadcastJobData>(
    'broadcast',
    async (job: Job<BroadcastJobData>) => {
      const {
        broadcastJobId,
        accountId,
        targets,
        messageText,
        parseMode,
        mediaAssetId,
        delayMs,
        jitterMs,
      } = job.data;

      logger.info(`Starting broadcast ${broadcastJobId}`, {
        targets: targets.length,
        delayMs,
        jitterMs,
      });

      // Mark as RUNNING
      await prisma.broadcastJob.update({
        where: { id: broadcastJobId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      let sent = 0;
      let failed = 0;
      let skipped = 0;

      // Check for a checkpoint (if resuming from pause)
      const checkpointStr = await redisConnection.get(
        `broadcast:${broadcastJobId}:checkpoint`
      );
      const startIndex = checkpointStr ? parseInt(checkpointStr, 10) : 0;

      for (let i = startIndex; i < targets.length; i++) {
        // ─── CHECK CONTROL FLAG ───────────────────────
        const controlFlag = await redisConnection.get(
          `broadcast:${broadcastJobId}:control`
        );

        if (controlFlag === 'CANCEL') {
          logger.info(`Broadcast ${broadcastJobId} cancelled at index ${i}`);
          await prisma.broadcastJob.update({
            where: { id: broadcastJobId },
            data: {
              status: 'CANCELLED',
              completedAt: new Date(),
              sentCount: sent,
              failedCount: failed,
              skippedCount: skipped,
            },
          });
          emitProgress(broadcastJobId, {
            sent,
            failed,
            skipped,
            total: targets.length,
            status: 'CANCELLED',
          });
          // Cleanup Redis
          await redisConnection.del(`broadcast:${broadcastJobId}:control`);
          await redisConnection.del(`broadcast:${broadcastJobId}:checkpoint`);
          return;
        }

        if (controlFlag === 'PAUSE') {
          logger.info(`Broadcast ${broadcastJobId} paused at index ${i}`);

          // Save checkpoint
          await redisConnection.set(
            `broadcast:${broadcastJobId}:checkpoint`,
            i.toString()
          );

          emitProgress(broadcastJobId, {
            sent,
            failed,
            skipped,
            total: targets.length,
            status: 'PAUSED',
          });

          // Wait for resume/cancel signal
          const signal = await waitForResume(broadcastJobId, redisConnection);

          if (signal === 'cancel') {
            await prisma.broadcastJob.update({
              where: { id: broadcastJobId },
              data: {
                status: 'CANCELLED',
                completedAt: new Date(),
                sentCount: sent,
                failedCount: failed,
                skippedCount: skipped,
              },
            });
            emitProgress(broadcastJobId, {
              sent,
              failed,
              skipped,
              total: targets.length,
              status: 'CANCELLED',
            });
            return;
          }

          // Clear the control flag and continue
          await redisConnection.del(`broadcast:${broadcastJobId}:control`);
          logger.info(`Broadcast ${broadcastJobId} resumed from index ${i}`);
        }

        // ─── SEND MESSAGE ─────────────────────────────
        const target = targets[i];

        try {
          const result = await telegramService.sendMessage(
            accountId,
            BigInt(target.telegramId),
            {
              text: messageText,
              parseMode,
              fileId: mediaAssetId,
            }
          );

          // Log success
          await prisma.messageLog.create({
            data: {
              broadcastJobId,
              accountId,
              targetUserId: target.type === 'user' ? target.id : null,
              targetGroupId: target.type === 'group' ? target.id : null,
              messageText: messageText,
              mediaAssetId,
              status: 'SENT',
              telegramMsgId: result.messageId,
              sentAt: new Date(),
            },
          });

          sent++;
        } catch (error: any) {
          // Handle FloodWaitError — respect Telegram's cooldown
          if (
            error.errorMessage === 'FLOOD_WAIT' ||
            error.message?.includes('FLOOD') ||
            error.seconds
          ) {
            const waitSeconds = error.seconds || 30;
            logger.warn(
              `FloodWait for ${waitSeconds}s on broadcast ${broadcastJobId}`
            );

            await prisma.broadcastJob.update({
              where: { id: broadcastJobId },
              data: {
                lastError: `FloodWait: ${waitSeconds}s at target ${i}/${targets.length}`,
              },
            });

            await sleep(waitSeconds * 1000 + 100);
            i--; // Retry this target
            continue;
          }

          // Non-fatal error: log and skip
          const errorCode =
            error.errorMessage || error.code || 'UNKNOWN';
          const errorMessage =
            error.message || 'Unknown error';

          logger.warn(
            `Failed to send to ${target.telegramId}: ${errorCode}`,
            { error: errorMessage }
          );

          // Determine if this is a skip or a fail
          const isSkip = [
            'USER_BANNED_IN_CHANNEL',
            'PEER_FLOOD',
            'USER_IS_BLOCKED',
            'USER_NOT_MUTUAL_CONTACT',
            'INPUT_USER_DEACTIVATED',
            'CHAT_WRITE_FORBIDDEN',
            'PEER_ID_INVALID',
          ].includes(errorCode);

          await prisma.messageLog.create({
            data: {
              broadcastJobId,
              accountId,
              targetUserId: target.type === 'user' ? target.id : null,
              targetGroupId: target.type === 'group' ? target.id : null,
              messageText: messageText,
              mediaAssetId,
              status: isSkip ? 'SKIPPED' : 'FAILED',
              errorMessage,
              errorCode,
            },
          });

          if (isSkip) {
            skipped++;
          } else {
            failed++;
          }
        }

        // Update progress in DB periodically (every 5 messages)
        if ((i + 1) % 5 === 0 || i === targets.length - 1) {
          await prisma.broadcastJob.update({
            where: { id: broadcastJobId },
            data: {
              sentCount: sent,
              failedCount: failed,
              skippedCount: skipped,
            },
          });
        }

        // Emit real-time progress
        emitProgress(broadcastJobId, {
          sent,
          failed,
          skipped,
          total: targets.length,
          currentTarget: target.telegramId,
          status: 'RUNNING',
        });

        // ─── DELAY WITH JITTER ────────────────────────
        if (i < targets.length - 1) {
          const jitter = Math.random() * jitterMs;
          await sleep(delayMs + jitter);
        }
      }

      // ─── BROADCAST COMPLETE ───────────────────────
      await prisma.broadcastJob.update({
        where: { id: broadcastJobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          sentCount: sent,
          failedCount: failed,
          skippedCount: skipped,
        },
      });

      emitProgress(broadcastJobId, {
        sent,
        failed,
        skipped,
        total: targets.length,
        status: 'COMPLETED',
      });

      // Cleanup Redis
      await redisConnection.del(`broadcast:${broadcastJobId}:control`);
      await redisConnection.del(`broadcast:${broadcastJobId}:checkpoint`);

      logger.info(`Broadcast ${broadcastJobId} completed`, {
        sent,
        failed,
        skipped,
        total: targets.length,
      });
    },
    {
      connection: redisConnection,
      concurrency: 1, // Process one broadcast at a time per worker
    }
  );

  worker.on('failed', (job, error) => {
    logger.error(`Broadcast worker job failed:`, {
      jobId: job?.id,
      error: error.message,
    });
  });

  worker.on('error', (error) => {
    logger.error('Broadcast worker error:', error);
  });

  logger.info('📡 Broadcast worker initialized');

  return worker;
}
