import { config } from '../config';

/**
 * Smart Broadcast Rate Calculator
 *
 * Calculates safe message delays based on target count and deadline.
 * Telegram's rate limits for userbots are dynamic and opaque, but empirically:
 * - Minimum safe delay: 5 seconds between messages to strangers
 * - Add random jitter (0-2s) to appear more human-like
 * - FloodWaitError handling is still needed as a safety net
 */

export interface RateCalculationResult {
  accepted: boolean;
  delayMs: number;
  jitterMs: number;
  estimatedDurationMs: number;
  suggestedDeadline?: Date;
  message: string;
}

/**
 * Validates a broadcast request and calculates safe message delays.
 *
 * @param totalTargets - Number of recipients
 * @param deadlineAt - Optional deadline by which broadcast must finish
 * @returns Calculation result with accepted/rejected status and safe parameters
 */
export function calculateBroadcastRate(
  totalTargets: number,
  deadlineAt?: Date
): RateCalculationResult {
  const { minSafeDelayMs, maxJitterMs, defaultDelayMs, defaultJitterMs } =
    config.broadcast;

  if (totalTargets <= 0) {
    return {
      accepted: false,
      delayMs: 0,
      jitterMs: 0,
      estimatedDurationMs: 0,
      message: 'No targets specified.',
    };
  }

  // If no deadline is set, use conservative defaults
  if (!deadlineAt) {
    const estimatedDurationMs =
      totalTargets * (defaultDelayMs + defaultJitterMs / 2);
    return {
      accepted: true,
      delayMs: defaultDelayMs,
      jitterMs: defaultJitterMs,
      estimatedDurationMs,
      message: `Using default safe delay of ${defaultDelayMs / 1000}s. Estimated duration: ${formatDuration(estimatedDurationMs)}.`,
    };
  }

  const now = Date.now();
  const availableTimeMs = deadlineAt.getTime() - now;

  if (availableTimeMs <= 0) {
    return {
      accepted: false,
      delayMs: 0,
      jitterMs: 0,
      estimatedDurationMs: 0,
      message: 'Deadline is in the past. Please set a future deadline.',
    };
  }

  // Calculate required delay to meet deadline
  const requiredDelayMs = availableTimeMs / totalTargets;

  // Check if the required speed exceeds safe limits
  if (requiredDelayMs < minSafeDelayMs) {
    // REJECT: The deadline is too tight
    const averageJitter = maxJitterMs / 2;
    const minSafeTimeMs = totalTargets * (minSafeDelayMs + averageJitter);
    const suggestedDeadline = new Date(now + minSafeTimeMs);

    return {
      accepted: false,
      delayMs: 0,
      jitterMs: 0,
      estimatedDurationMs: minSafeTimeMs,
      suggestedDeadline,
      message:
        `⚠️ Deadline too tight! To send ${totalTargets} messages safely, ` +
        `please allocate at least ${formatDuration(minSafeTimeMs)}. ` +
        `Suggested deadline: ${suggestedDeadline.toLocaleString()}.`,
    };
  }

  // ACCEPT: Distribute messages evenly within the deadline window
  // Use 20% of delay as jitter, capped at maxJitterMs
  const jitterMs = Math.min(Math.floor(requiredDelayMs * 0.2), maxJitterMs);
  const actualDelayMs = Math.floor(requiredDelayMs - jitterMs / 2);
  const estimatedDurationMs = totalTargets * (actualDelayMs + jitterMs / 2);

  return {
    accepted: true,
    delayMs: actualDelayMs,
    jitterMs,
    estimatedDurationMs,
    message:
      `✅ Rate accepted. Delay: ${(actualDelayMs / 1000).toFixed(1)}s ` +
      `(±${(jitterMs / 1000).toFixed(1)}s jitter). ` +
      `Estimated duration: ${formatDuration(estimatedDurationMs)}.`,
  };
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 * Examples: "2h 30m", "45m", "1h 5m 30s"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);

  return parts.join(' ') || '0s';
}
