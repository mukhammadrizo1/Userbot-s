import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.middleware';

const router = Router();
const prisma = new PrismaClient();

// ─── TICKETS ──────────────────────────────────────────────

const CreateTicketSchema = z.object({
  name: z.string().min(1),
  keywords: z.string().min(1), // pipe separated
  aiPrompt: z.string().min(10),
  autoReplyMessage: z.string().optional(),
  targetGroups: z.array(z.string()).optional(),
  targetCategories: z.array(z.string()).optional()
});

router.post('/tickets', validateRequest(CreateTicketSchema), async (req, res) => {
  try {
    const { name, keywords, aiPrompt, autoReplyMessage, targetGroups, targetCategories } = req.body;
    
    const ticket = await prisma.spyTicket.create({
      data: {
        name, keywords, aiPrompt, autoReplyMessage, status: 'RUNNING',
        targets: {
          create: [
            ...(targetGroups || []).map((id: string) => ({ groupId: id })),
            ...(targetCategories || []).map((id: string) => ({ categoryId: id }))
          ]
        }
      },
      include: { targets: true }
    });
    
    res.json(ticket);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tickets', async (req, res) => {
  try {
    const tickets = await prisma.spyTicket.findMany({
      where: { isDeleted: false },
      include: {
        targets: true,
        _count: {
          select: { capturedLeads: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ tickets });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/tickets/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await prisma.spyTicket.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.json(ticket);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tickets/:id', async (req, res) => {
  try {
    const ticket = await prisma.spyTicket.update({
      where: { id: req.params.id },
      data: { isDeleted: true, status: 'CANCELLED' }
    });
    res.json(ticket);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── CAPTURED LEADS ───────────────────────────────────────

router.get('/tickets/:id/leads', async (req, res) => {
  try {
    const leads = await prisma.capturedLead.findMany({
      where: { ticketId: req.params.id, isDeleted: false },
      include: {
        user: true,
        group: true,
        message: true
      },
      orderBy: { capturedAt: 'desc' }
    });
    res.json({ leads });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/leads/:id', async (req, res) => {
  try {
    const lead = await prisma.capturedLead.update({
      where: { id: req.params.id },
      data: { isDeleted: true }
    });
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
