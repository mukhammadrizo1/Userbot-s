import {
  PrismaClient,
  BroadcastStatus,
  BroadcastJob,
} from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'bullmq/node_modules/ioredis';
import { config } from '../config';
import {
  calculateBroadcastRate,
  RateCalculationResult,
} from '../lib/rate-calculator';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

const redisConnection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

// BullMQ queue for broadcast jobs
const broadcastQueue = new Queue('broadcast', {
  connection: redisConnection,
});

export interface CreateBroadcastInput {
  name?: string;
  messageText?: string;
  parseMode?: string;
  mediaAssetId?: string;
  accountId: string;
  targetType: 'USERS' | 'GROUPS' | 'MIXED';
  targetIds: string[];
  deadlineAt?: string; // ISO date string
}

/**
 * Broadcast Service
 *
 * Manages the lifecycle of broadcast jobs:
 * - Create → Validate rate → Queue → Execute → Complete/Fail
 * - Pause/Resume/Cancel via Redis control flags
 * - Real-time progress tracking
 */
export class BroadcastService {
  /**
   * Validate a broadcast configuration without creating it.
   * Returns rate calculation results so the frontend can preview.
   */
  async validateBroadcast(input: CreateBroadcastInput): Promise<RateCalculationResult> {
    const totalTargets = input.targetIds.length;
    const deadlineAt = input.deadlineAt
      ? new Date(input.deadlineAt)
      : undefined;

    return calculateBroadcastRate(totalTargets, deadlineAt);
  }

  /**
   * Create and queue a new broadcast job.
   * First validates the rate, then creates the DB record and BullMQ job.
   */
  async createBroadcast(input: CreateBroadcastInput): Promise<{
    job: BroadcastJob;
    rateInfo: RateCalculationResult;
  }> {
    const totalTargets = input.targetIds.length;
    const deadlineAt = input.deadlineAt
      ? new Date(input.deadlineAt)
      : undefined;

    // Validate rate
    const rateInfo = calculateBroadcastRate(totalTargets, deadlineAt);
    if (!rateInfo.accepted) {
      throw new Error(rateInfo.message);
    }

    // Verify the account exists and is connected
    const account = await prisma.account.findUnique({
      where: { id: input.accountId },
    });
    if (!account || account.status !== 'CONNECTED') {
      throw new Error('Selected account is not connected');
    }

    // Resolve target Telegram IDs
    const targets = await this.resolveTargetIds(
      input.targetIds,
      input.targetType
    );

    // Create the broadcast job in DB
    const job = await prisma.broadcastJob.create({
      data: {
        name: input.name,
        messageText: input.messageText,
        parseMode: input.parseMode || 'HTML',
        mediaAssetId: input.mediaAssetId || null,
        accountId: input.accountId,
        targetType: input.targetType,
        targetIds: targets,
        totalTargets: targets.length,
        deadlineAt,
        delayMs: rateInfo.delayMs,
        jitterMs: rateInfo.jitterMs,
        status: 'QUEUED',
      },
    });

    // Add to BullMQ queue
    await broadcastQueue.add(
      'send-broadcast',
      {
        broadcastJobId: job.id,
        accountId: input.accountId,
        targets,
        messageText: input.messageText,
        parseMode: input.parseMode || 'HTML',
        mediaAssetId: input.mediaAssetId,
        delayMs: rateInfo.delayMs,
        jitterMs: rateInfo.jitterMs,
      },
      {
        jobId: job.id,
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    logger.info(`Broadcast job created: ${job.id}`, {
      targets: targets.length,
      delay: rateInfo.delayMs,
      deadline: deadlineAt?.toISOString(),
    });

    return { job, rateInfo };
  }

  /**
   * Pause a running broadcast.
   */
  async pauseBroadcast(jobId: string): Promise<void> {
    await redisConnection.set(`broadcast:${jobId}:control`, 'PAUSE');
    await prisma.broadcastJob.update({
      where: { id: jobId },
      data: { status: 'PAUSED', pausedAt: new Date() },
    });
    logger.info(`Broadcast ${jobId} paused`);
  }

  /**
   * Resume a paused broadcast.
   */
  async resumeBroadcast(jobId: string): Promise<void> {
    await redisConnection.set(`broadcast:${jobId}:control`, 'RESUME');
    // Publish a resume event so the worker can wake up
    await redisConnection.publish(
      `broadcast:${jobId}:resume`,
      'resume'
    );
    await prisma.broadcastJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', pausedAt: null },
    });
    logger.info(`Broadcast ${jobId} resumed`);
  }

  /**
   * Cancel a broadcast (running or paused).
   */
  async cancelBroadcast(jobId: string): Promise<void> {
    await redisConnection.set(`broadcast:${jobId}:control`, 'CANCEL');
    // Also publish for paused workers
    await redisConnection.publish(
      `broadcast:${jobId}:resume`,
      'cancel'
    );
    await prisma.broadcastJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    logger.info(`Broadcast ${jobId} cancelled`);
  }

  /**
   * Get the current status and progress of a broadcast job.
   */
  async getBroadcastStatus(jobId: string) {
    const job = await prisma.broadcastJob.findUnique({
      where: { id: jobId },
      include: {
        account: {
          select: { phone: true, firstName: true, username: true },
        },
        mediaAsset: true,
      },
    });

    if (!job) throw new Error('Broadcast job not found');

    const progress =
      job.totalTargets > 0
        ? ((job.sentCount + job.failedCount + job.skippedCount) /
            job.totalTargets) *
          100
        : 0;

    return {
      ...job,
      progress: Math.round(progress * 10) / 10,
    };
  }

  /**
   * Get all broadcast jobs with pagination.
   */
  async listBroadcasts(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.broadcastJob.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: { phone: true, firstName: true, username: true },
          },
        },
      }),
      prisma.broadcastJob.count(),
    ]);

    return { jobs, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Get message logs for a specific broadcast job.
   */
  async getBroadcastLogs(
    jobId: string,
    page: number = 1,
    limit: number = 50,
    statusFilter?: string
  ) {
    const skip = (page - 1) * limit;

    const where: any = { broadcastJobId: jobId };
    if (statusFilter) {
      where.status = statusFilter;
    }

    const [logs, total] = await Promise.all([
      prisma.messageLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          targetUser: {
            select: { username: true, firstName: true },
          },
          targetGroup: {
            select: { title: true, username: true },
          },
        },
      }),
      prisma.messageLog.count({ where }),
    ]);

    return { logs, total, page, pages: Math.ceil(total / limit) };
  }

  /**
   * Resolve internal IDs to target Telegram IDs for the worker.
   */
  private async resolveTargetIds(
    ids: string[],
    targetType: string
  ): Promise<Array<{ id: string; telegramId: string; type: 'user' | 'group' }>> {
    const targets: Array<{
      id: string;
      telegramId: string;
      type: 'user' | 'group';
    }> = [];

    if (targetType === 'USERS' || targetType === 'MIXED') {
      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, telegramId: true },
      });
      targets.push(
        ...users.map((u) => ({
          id: u.id,
          telegramId: u.telegramId.toString(),
          type: 'user' as const,
        }))
      );
    }

    if (targetType === 'GROUPS' || targetType === 'MIXED') {
      const groups = await prisma.group.findMany({
        where: { id: { in: ids } },
        select: { id: true, telegramId: true },
      });
      targets.push(
        ...groups.map((g) => ({
          id: g.id,
          telegramId: g.telegramId.toString(),
          type: 'group' as const,
        }))
      );
    }

    return targets;
  }
}

export const broadcastService = new BroadcastService();
