import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();
const router = Router();

function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

/**
 * GET /api/categories
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, groups: true } },
      },
    });

    const mapped = categories.map((c) => ({
      ...c,
      userCount: c._count.users,
      groupCount: c._count.groups,
    }));

    res.json({ categories: mapped });
  } catch (error: any) {
    logger.error('Failed to list categories:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/categories
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }
    const category = await prisma.category.create({
      data: { name, color: color || undefined },
    });
    res.json({ category, message: 'Category created' });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Category name already exists' });
      return;
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * PATCH /api/categories/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, color } = req.body;
    const category = await prisma.category.update({
      where: { id: getParam(req, 'id') },
      data: { name: name || undefined, color: color || undefined },
    });
    res.json({ category });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/categories/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.category.delete({ where: { id: getParam(req, 'id') } });
    res.json({ message: 'Category deleted', success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/categories/:id/assign/user
 */
router.post('/:id/assign/user', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    await prisma.categoriesOnUsers.create({
      data: { userId: userId as string, categoryId: getParam(req, 'id') },
    });
    res.json({ message: 'Category assigned to user', success: true });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Category already assigned to this user' });
      return;
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/categories/:id/assign/user/:userId
 */
router.delete('/:id/assign/user/:userId', async (req: Request, res: Response) => {
  try {
    await prisma.categoriesOnUsers.delete({
      where: {
        userId_categoryId: {
          userId: getParam(req, 'userId'),
          categoryId: getParam(req, 'id'),
        },
      },
    });
    res.json({ message: 'Category removed from user', success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/categories/:id/assign/group
 */
router.post('/:id/assign/group', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.body;
    await prisma.categoriesOnGroups.create({
      data: { groupId: groupId as string, categoryId: getParam(req, 'id') },
    });
    res.json({ message: 'Category assigned to group', success: true });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Category already assigned to this group' });
      return;
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/categories/:id/assign/group/:groupId
 */
router.delete('/:id/assign/group/:groupId', async (req: Request, res: Response) => {
  try {
    await prisma.categoriesOnGroups.delete({
      where: {
        groupId_categoryId: {
          groupId: getParam(req, 'groupId'),
          categoryId: getParam(req, 'id'),
        },
      },
    });
    res.json({ message: 'Category removed from group', success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
