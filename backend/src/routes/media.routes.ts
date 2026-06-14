import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { mediaService } from '../services/media.service';
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

// Configure multer for file uploads
const upload = multer({
  dest: path.resolve(__dirname, '../../temp/uploads/'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

/**
 * GET /api/media
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(getQuery(req, 'page') || '1', 10);
    const limit = parseInt(getQuery(req, 'limit') || '20', 10);
    const result = await mediaService.listMedia(page, limit);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to list media:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/media/upload
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const asset = await mediaService.uploadMedia(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      req.body.caption
    );

    res.json({ message: 'Media uploaded successfully', asset });
  } catch (error: any) {
    logger.error('Failed to upload media:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/media/:id/url
 */
router.get('/:id/url', async (req: Request, res: Response) => {
  try {
    const url = await mediaService.getMediaUrl(getParam(req, 'id'));
    res.json({ url });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * DELETE /api/media/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await mediaService.deleteMedia(getParam(req, 'id'));
    res.json({ message: 'Media asset deleted', success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
