import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.middleware';
import { Queue } from 'bullmq';
import IORedis from 'bullmq/node_modules/ioredis';
import { config } from '../config';

const router = Router();
const scraperQueue = new Queue('scraper', {
  connection: new IORedis(config.redisUrl, { maxRetriesPerRequest: null })
});

const ScrapeSchema = z.object({
  targetGroups: z.array(z.object({
    id: z.string(),
    telegramId: z.string(),
    title: z.string()
  })),
  limitPerGroup: z.number().default(200),
  accountId: z.string().optional()
});

router.post('/start', validateRequest(ScrapeSchema), async (req, res) => {
  try {
    const { targetGroups, limitPerGroup, accountId } = req.body;
    
    const job = await scraperQueue.add('scrape-groups', {
      scrapeJobId: Date.now().toString(),
      targetGroups,
      limitPerGroup,
      accountId
    });
    
    res.json({ jobId: job.id, message: 'Scraping job queued' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// We can also add endpoints to parse raw links and convert them to targetGroups.
// That logic can be put here.

export default router;
