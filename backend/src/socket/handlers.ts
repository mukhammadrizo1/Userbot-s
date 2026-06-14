import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../lib/logger';

/**
 * Socket.IO Event Handlers
 *
 * Handles real-time communication between backend and frontend:
 * - Broadcast progress updates
 * - New incoming messages from userbot accounts
 * - Account status changes
 */
export function setupSocketHandlers(io: SocketIOServer): void {
  io.on('connection', (socket: Socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    /**
     * Subscribe to broadcast progress updates.
     * Frontend sends: { jobId: string }
     */
    socket.on('broadcast:subscribe', (data: { jobId: string }) => {
      const room = `broadcast:${data.jobId}`;
      socket.join(room);
      logger.debug(`Socket ${socket.id} subscribed to ${room}`);
    });

    /**
     * Unsubscribe from broadcast progress.
     */
    socket.on('broadcast:unsubscribe', (data: { jobId: string }) => {
      const room = `broadcast:${data.jobId}`;
      socket.leave(room);
      logger.debug(`Socket ${socket.id} unsubscribed from ${room}`);
    });

    /**
     * Subscribe to account updates (new messages, status changes).
     */
    socket.on('account:subscribe', (data: { accountId: string }) => {
      const room = `account:${data.accountId}`;
      socket.join(room);
      logger.debug(`Socket ${socket.id} subscribed to ${room}`);
    });

    socket.on('account:unsubscribe', (data: { accountId: string }) => {
      const room = `account:${data.accountId}`;
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });
}

/**
 * Emit a new incoming message event to subscribed clients.
 */
export function emitNewMessage(
  io: SocketIOServer,
  accountId: string,
  message: {
    chatId: string;
    chatTitle?: string;
    senderName?: string;
    text?: string;
    date: number;
    isGroup: boolean;
  }
): void {
  io.to(`account:${accountId}`).emit('account:newMessage', {
    accountId,
    message,
  });
}

/**
 * Emit an account status change event.
 */
export function emitAccountStatus(
  io: SocketIOServer,
  accountId: string,
  status: string
): void {
  io.emit('account:statusChange', { accountId, status });
}
