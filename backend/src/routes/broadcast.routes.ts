import { Router, Request, Response } from 'express';
import { broadcastService } from '../services/broadcast.service';
import { logger } from '../lib/logger';

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
 * GET /api/broadcast
 * List all broadcast jobs with pagination.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(getQuery(req, 'page') || '1', 10);
    const limit = parseInt(getQuery(req, 'limit') || '20', 10);
    const result = await broadcastService.listBroadcasts(page, limit);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to list broadcasts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/broadcast/validate
 * Validate a broadcast configuration and preview the rate calculation.
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const rateInfo = await broadcastService.validateBroadcast(req.body);
    res.json({ rateInfo });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/broadcast
 * Create and queue a new broadcast job.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const result = await broadcastService.createBroadcast(req.body);
    res.json({
      message: 'Broadcast queued successfully',
      job: result.job,
      rateInfo: result.rateInfo,
    });
  } catch (error: any) {
    logger.error('Failed to create broadcast:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/broadcast/:id
 * Get the status and progress of a broadcast job.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const status = await broadcastService.getBroadcastStatus(getParam(req, 'id'));
    res.json({ broadcast: status });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /api/broadcast/:id/pause
 */
router.post('/:id/pause', async (req: Request, res: Response) => {
  try {
    await broadcastService.pauseBroadcast(getParam(req, 'id'));
    res.json({ message: 'Broadcast paused', success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/broadcast/:id/resume
 */
router.post('/:id/resume', async (req: Request, res: Response) => {
  try {
    await broadcastService.resumeBroadcast(getParam(req, 'id'));
    res.json({ message: 'Broadcast resumed', success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/broadcast/:id/cancel
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    await broadcastService.cancelBroadcast(getParam(req, 'id'));
    res.json({ message: 'Broadcast cancelled', success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/broadcast/:id/logs
 */
router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const page = parseInt(getQuery(req, 'page') || '1', 10);
    const limit = parseInt(getQuery(req, 'limit') || '50', 10);
    const status = getQuery(req, 'status');

    const result = await broadcastService.getBroadcastLogs(
      getParam(req, 'id'),
      page,
      limit,
      status
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
