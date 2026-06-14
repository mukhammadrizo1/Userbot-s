import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { gramJsPool } from '../lib/gramjs-pool';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/dashboard
 * Get dashboard overview data.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [
      accountCount,
      connectedAccounts,
      userCount,
      groupCount,
      categoryCount,
      mediaCount,
      activeBroadcasts,
      recentBroadcasts,
      recentMessages,
    ] = await Promise.all([
      prisma.account.count(),
      prisma.account.count({ where: { status: 'CONNECTED' } }),
      prisma.user.count(),
      prisma.group.count(),
      prisma.category.count(),
      prisma.mediaAsset.count(),
      prisma.broadcastJob.count({
        where: { status: { in: ['RUNNING', 'PAUSED', 'QUEUED'] } },
      }),
      prisma.broadcastJob.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          totalTargets: true,
          sentCount: true,
          failedCount: true,
          createdAt: true,
        },
      }),
      prisma.messageLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          sentAt: true,
          targetUser: { select: { username: true, firstName: true } },
          targetGroup: { select: { title: true } },
        },
      }),
    ]);

    res.json({
      stats: {
        accounts: { total: accountCount, connected: connectedAccounts },
        users: userCount,
        groups: groupCount,
        categories: categoryCount,
        media: mediaCount,
        activeBroadcasts,
      },
      recentBroadcasts,
      recentMessages,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
