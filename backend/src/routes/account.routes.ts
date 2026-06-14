import { Router, Request, Response } from 'express';
import { accountService } from '../services/account.service';
import { logger } from '../lib/logger';

const router = Router();

/** Helper to extract a route param safely */
function getParam(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

/**
 * GET /api/accounts
 * List all userbot accounts with their connection status.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const accounts = await accountService.getAllAccounts();
    res.json({ accounts });
  } catch (error: any) {
    logger.error('Failed to list accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/accounts/:id
 * Get a single account's details.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const account = await accountService.getAccount(getParam(req, 'id'));
    res.json({ account });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /api/accounts/add
 * Start adding a new Telegram account (initiates phone verification).
 * Body: { phone: "+998..." }
 */
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const result = await accountService.addAccount(phone);
    res.json({
      message: 'Verification code sent to your phone',
      accountId: result.accountId,
      phoneCodeHash: result.phoneCodeHash,
    });
  } catch (error: any) {
    logger.error('Failed to add account:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/accounts/:id/verify
 * Submit the verification code.
 * Body: { code: "12345" }
 */
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Verification code is required' });
      return;
    }

    const result = await accountService.submitCode(getParam(req, 'id'), code);

    if (result.needs2FA) {
      res.json({
        message: 'Two-factor authentication required',
        needs2FA: true,
      });
    } else {
      res.json({
        message: 'Account verified and connected successfully',
        success: true,
      });
    }
  } catch (error: any) {
    logger.error('Failed to verify account:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/accounts/:id/2fa
 * Submit the 2FA password.
 * Body: { password: "my2fapassword" }
 */
router.post('/:id/2fa', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: '2FA password is required' });
      return;
    }

    await accountService.submit2FA(getParam(req, 'id'), password);
    res.json({
      message: 'Account authenticated successfully',
      success: true,
    });
  } catch (error: any) {
    logger.error('Failed to submit 2FA:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/accounts/:id/connect
 * Reconnect a disconnected account.
 */
router.post('/:id/connect', async (req: Request, res: Response) => {
  try {
    await accountService.connectAccount(getParam(req, 'id'));
    res.json({ message: 'Account connected', success: true });
  } catch (error: any) {
    logger.error('Failed to connect account:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/accounts/:id/disconnect
 * Disconnect a connected account (keeps it in DB).
 */
router.post('/:id/disconnect', async (req: Request, res: Response) => {
  try {
    await accountService.disconnectAccount(getParam(req, 'id'));
    res.json({ message: 'Account disconnected', success: true });
  } catch (error: any) {
    logger.error('Failed to disconnect account:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/accounts/:id
 * Remove an account entirely.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await accountService.removeAccount(getParam(req, 'id'));
    res.json({ message: 'Account removed', success: true });
  } catch (error: any) {
    logger.error('Failed to remove account:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/accounts/:id/dialogs
 * Get all dialogs (chats/groups) for a connected account.
 */
router.get('/:id/dialogs', async (req: Request, res: Response) => {
  try {
    const dialogs = await accountService.getAccountDialogs(getParam(req, 'id'));
    res.json({ dialogs });
  } catch (error: any) {
    logger.error('Failed to get dialogs:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/accounts/:id/me
 * Get the Telegram "me" info for a connected account.
 */
router.get('/:id/me', async (req: Request, res: Response) => {
  try {
    const me = await accountService.getAccountMe(getParam(req, 'id'));
    res.json({ me });
  } catch (error: any) {
    logger.error('Failed to get account info:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
