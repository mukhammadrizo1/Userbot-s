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
 * GET /api/users
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
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) {
      where.categories = { some: { categoryId } };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          categories: { include: { category: true } },
          groups: {
            include: { group: { select: { title: true } } },
            take: 5,
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const mapped = users.map((u) => ({
      ...u,
      telegramId: u.telegramId.toString(),
      categories: u.categories.map((c: any) => c.category),
      groups: u.groups.map((g: any) => ({
        groupId: g.groupId,
        title: g.group.title,
        role: g.role,
      })),
    }));

    res.json({ users: mapped, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    logger.error('Failed to list users:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/users/add
 */
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { input, accountId } = req.body;
    if (!input) {
      res.status(400).json({ error: 'Input is required' });
      return;
    }

    const userData = await telegramService.resolveUser(input, accountId);

    const user = await prisma.user.upsert({
      where: { telegramId: userData.telegramId },
      create: {
        telegramId: userData.telegramId,
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        isBot: userData.isBot,
        isPremium: userData.isPremium,
        accessHash: userData.accessHash,
      },
      update: {
        username: userData.username || undefined,
        firstName: userData.firstName || undefined,
        lastName: userData.lastName || undefined,
        isPremium: userData.isPremium,
        accessHash: userData.accessHash || undefined,
      },
    });

    res.json({
      user: { ...user, telegramId: user.telegramId.toString() },
      message: 'User added successfully',
    });
  } catch (error: any) {
    logger.error('Failed to add user:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/users/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: getParam(req, 'id') },
      include: {
        categories: { include: { category: true } },
        groups: {
          include: { group: { select: { id: true, title: true, username: true } } },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        ...user,
        telegramId: user.telegramId.toString(),
        categories: user.categories.map((c: any) => c.category),
        groups: user.groups.map((g: any) => ({
          ...g.group,
          role: g.role,
          joinedAt: g.joinedAt,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/:id/full
 */
router.get('/:id/full', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: getParam(req, 'id') },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const fullInfo = await telegramService.getUserFullInfo(
      user.telegramId,
      getQuery(req, 'accountId')
    );

    if (fullInfo.bio) {
      await prisma.user.update({
        where: { id: user.id },
        data: { bio: fullInfo.bio },
      });
    }

    res.json({ user: { ...fullInfo, telegramId: fullInfo.telegramId.toString() } });
  } catch (error: any) {
    logger.error('Failed to fetch full user info:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/users/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: getParam(req, 'id') } });
    res.json({ message: 'User deleted', success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * PATCH /api/users/:id/notes
 */
router.patch('/:id/notes', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: getParam(req, 'id') },
      data: { notes: req.body.notes },
    });
    res.json({ user: { ...user, telegramId: user.telegramId.toString() } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
