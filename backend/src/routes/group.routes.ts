import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { telegramService } from '../services/telegram.service';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();
const router = Router();

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

function getQuery(req: Request, name: string): string | undefined {
  const val = req.query[name];
  if (typeof val === 'string') return val;
  return undefined;
}

/**
 * GET /api/groups
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(getQuery(req, 'page') || '1', 10);
    const limit = parseInt(getQuery(req, 'limit') || '20', 10);
    const search = getQuery(req, 'search');
    const categoryId = getQuery(req, 'categoryId');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) {
      where.categories = { some: { categoryId } };
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          categories: { include: { category: true } },
          _count: { select: { members: true } },
        },
      }),
      prisma.group.count({ where }),
    ]);

    const mapped = groups.map((g) => ({
      ...g,
      telegramId: g.telegramId.toString(),
      categories: g.categories.map((c: any) => c.category),
      dbMemberCount: g._count.members,
    }));

    res.json({ groups: mapped, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    logger.error('Failed to list groups:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/groups/add
 */
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { input, accountId } = req.body;
    if (!input) {
      res.status(400).json({ error: 'Input is required' });
      return;
    }

    const groupData = await telegramService.resolveGroup(input, accountId);

    const group = await prisma.group.upsert({
      where: { telegramId: groupData.telegramId },
      create: {
        telegramId: groupData.telegramId,
        title: groupData.title,
        username: groupData.username,
        type: groupData.type,
        memberCount: groupData.memberCount,
        accessHash: groupData.accessHash,
      },
      update: {
        title: groupData.title,
        username: groupData.username || undefined,
        type: groupData.type,
        memberCount: groupData.memberCount || undefined,
        accessHash: groupData.accessHash || undefined,
      },
    });

    res.json({
      group: { ...group, telegramId: group.telegramId.toString() },
      message: 'Group added successfully',
    });
  } catch (error: any) {
    logger.error('Failed to add group:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/groups/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: getParam(req, 'id') },
      include: {
        categories: { include: { category: true } },
        _count: { select: { members: true } },
      },
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    res.json({
      group: {
        ...group,
        telegramId: group.telegramId.toString(),
        categories: group.categories.map((c: any) => c.category),
        dbMemberCount: group._count.members,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/groups/:id/full
 */
router.get('/:id/full', async (req: Request, res: Response) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: getParam(req, 'id') },
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const fullInfo = await telegramService.getGroupFullInfo(
      group.telegramId,
      getQuery(req, 'accountId')
    );

    if (fullInfo.about) {
      await prisma.group.update({
        where: { id: group.id },
        data: { description: fullInfo.about },
      });
    }

    res.json({
      group: { ...fullInfo, telegramId: fullInfo.telegramId.toString() },
    });
  } catch (error: any) {
    logger.error('Failed to fetch full group info:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/groups/:id/members
 */
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const page = parseInt(getQuery(req, 'page') || '1', 10);
    const limit = parseInt(getQuery(req, 'limit') || '50', 10);
    const skip = (page - 1) * limit;
    const groupId = getParam(req, 'id');

    const [members, total] = await Promise.all([
      prisma.userGroup.findMany({
        where: { groupId },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              username: true,
              firstName: true,
              lastName: true,
              isPremium: true,
            },
          },
        },
      }),
      prisma.userGroup.count({ where: { groupId } }),
    ]);

    const mapped = members.map((m) => ({
      ...m.user,
      telegramId: m.user.telegramId.toString(),
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    res.json({ members: mapped, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/groups/:id/scrape
 */
router.post('/:id/scrape', async (req: Request, res: Response) => {
  try {
    const { accountId, limit } = req.body;
    const result = await telegramService.scrapeGroupParticipants(
      getParam(req, 'id'),
      accountId,
      limit || 200
    );

    res.json({
      message: `Scraped ${result.total} participants, added ${result.added}, skipped ${result.skipped}`,
      ...result,
    });
  } catch (error: any) {
    logger.error('Failed to scrape group:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PATCH /api/groups/:id/monitor
 */
router.patch('/:id/monitor', async (req: Request, res: Response) => {
  try {
    const group = await prisma.group.update({
      where: { id: getParam(req, 'id') },
      data: { isMonitored: req.body.isMonitored },
    });
    res.json({ group: { ...group, telegramId: group.telegramId.toString() } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/groups/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.group.delete({ where: { id: getParam(req, 'id') } });
    res.json({ message: 'Group deleted', success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
