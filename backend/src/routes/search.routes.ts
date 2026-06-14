import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const { q, groupId, userId, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    const where: any = {};
    
    if (q) {
      where.messageText = { contains: String(q), mode: 'insensitive' };
    }
    if (groupId) {
      where.groupId = String(groupId);
    }
    if (userId) {
      where.userId = String(userId);
    }
    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) where.sentAt.gte = new Date(String(startDate));
      if (endDate) where.sentAt.lte = new Date(String(endDate));
    }
    
    const messages = await prisma.scrapedMessage.findMany({
      where,
      include: {
        user: true,
        group: true
      },
      orderBy: { sentAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });
    
    const total = await prisma.scrapedMessage.count({ where });
    
    res.json({ messages, total, page: Number(page), limit: Number(limit) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// User History route (could also go in user.routes.ts, but placing here for simplicity)
router.get('/user-history/:userId', async (req, res) => {
  try {
    const history = await prisma.userHistory.findMany({
      where: { userId: req.params.userId },
      orderBy: { observedAt: 'desc' }
    });
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
