import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../lib/logger';

/**
 * Extended Request interface that includes the validated Telegram user.
 */
export interface AuthenticatedRequest extends Request {
  telegramUser?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
  };
}

/**
 * Validates the Telegram Web App initData to ensure:
 * 1. The request genuinely comes from Telegram (HMAC-SHA256 verification)
 * 2. The data hasn't expired (5-minute window)
 * 3. The user is in the whitelist
 */
export function validateTelegramAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // In development, allow bypass with a special header
  if (
    config.nodeEnv === 'development' &&
    req.headers['x-dev-bypass'] === 'true'
  ) {
    req.telegramUser = {
      id: config.whitelistedUserIds[0] || 0,
      first_name: 'Dev',
      username: 'developer',
    };
    next();
    return;
  }

  const initData = req.headers['x-telegram-init-data'] as string;

  if (!initData) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Missing Telegram initData header',
    });
    return;
  }

  try {
    // 1. Parse the initData query string
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');

    if (!receivedHash) {
      res.status(403).json({
        error: 'Invalid initData',
        message: 'Missing hash parameter',
      });
      return;
    }

    // 2. Sort parameters alphabetically and remove hash
    params.delete('hash');
    params.sort();

    // 3. Create the data-check-string (newline-separated key=value pairs)
    const dataCheckString = [...params.entries()]
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // 4. Generate the secret key: HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(config.botToken)
      .digest();

    // 5. Generate and compare the hash
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== receivedHash) {
      logger.warn('initData validation failed: hash mismatch');
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid Telegram signature',
      });
      return;
    }

    // 6. Check timestamp freshness (reject data older than 5 minutes)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    const MAX_AGE_SECONDS = 300; // 5 minutes

    if (now - authDate > MAX_AGE_SECONDS) {
      logger.warn('initData validation failed: expired', {
        authDate,
        now,
        diff: now - authDate,
      });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Telegram initData has expired',
      });
      return;
    }

    // 7. Extract and validate user
    const userString = params.get('user');
    if (!userString) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'No user data in initData',
      });
      return;
    }

    const user = JSON.parse(userString);

    // 8. Whitelist check
    if (!config.whitelistedUserIds.includes(user.id)) {
      logger.warn('Unauthorized access attempt', {
        userId: user.id,
        username: user.username,
      });
      res.status(403).json({
        error: 'Access denied',
        message: 'You are not authorized to use this application',
      });
      return;
    }

    // 9. Attach user to request
    req.telegramUser = user;
    next();
  } catch (error) {
    logger.error('initData validation error:', error);
    res.status(500).json({
      error: 'Internal error',
      message: 'Failed to validate authentication',
    });
  }
}

/**
 * Error handling middleware — catches all unhandled errors
 * and returns a safe JSON response without leaking internals.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal server error',
    message:
      config.nodeEnv === 'development'
        ? err.message
        : 'An unexpected error occurred',
  });
}
