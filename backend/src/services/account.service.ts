import { PrismaClient, Account, AccountStatus } from '@prisma/client';
import { gramJsPool, AccountInfo } from '../lib/gramjs-pool';
import { Api } from 'telegram';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

/**
 * Account Service
 *
 * Handles all business logic related to userbot account management:
 * - Adding new accounts (starts auth flow)
 * - Verifying codes and 2FA
 * - Connecting/disconnecting accounts
 * - Fetching account details and dialogs
 */
export class AccountService {
  /**
   * Add a new Telegram account. Initiates the phone verification flow.
   */
  async addAccount(phone: string) {
    // Normalize phone number
    const normalizedPhone = phone.replace(/\s+/g, '').replace(/^(\+)?/, '+');

    return gramJsPool.addAccount(normalizedPhone);
  }

  /**
   * Submit verification code for a pending account.
   */
  async submitCode(accountId: string, code: string) {
    return gramJsPool.submitCode(accountId, code);
  }

  /**
   * Submit 2FA password for a pending account.
   */
  async submit2FA(accountId: string, password: string) {
    return gramJsPool.submit2FA(accountId, password);
  }

  /**
   * Connect an existing (authenticated) account.
   */
  async connectAccount(accountId: string) {
    return gramJsPool.connectAccount(accountId);
  }

  /**
   * Disconnect an account (keeps it in DB).
   */
  async disconnectAccount(accountId: string) {
    return gramJsPool.disconnectAccount(accountId);
  }

  /**
   * Remove an account entirely.
   */
  async removeAccount(accountId: string) {
    return gramJsPool.removeAccount(accountId);
  }

  /**
   * Get all accounts with their connection status.
   */
  async getAllAccounts(): Promise<AccountInfo[]> {
    return gramJsPool.getAllAccountStatuses();
  }

  /**
   * Get a single account's full details.
   */
  async getAccount(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        phone: true,
        telegramId: true,
        firstName: true,
        lastName: true,
        username: true,
        status: true,
        isActive: true,
        lastConnectedAt: true,
        createdAt: true,
      },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    return {
      ...account,
      telegramId: account.telegramId?.toString(),
      isOnline: gramJsPool.isConnected(accountId),
    };
  }

  /**
   * Get all dialogs (chats) for a connected account.
   * This shows which groups the account has joined and its personal chats.
   */
  async getAccountDialogs(accountId: string) {
    const client = gramJsPool.getClient(accountId);
    const dialogs = await client.getDialogs({ limit: 100 });

    return dialogs.map((dialog) => ({
      id: dialog.id?.toString(),
      title: dialog.title,
      name: dialog.name,
      isGroup: dialog.isGroup,
      isChannel: dialog.isChannel,
      isUser: dialog.isUser,
      unreadCount: dialog.unreadCount,
      date: dialog.date,
      message: dialog.message?.text?.substring(0, 100),
    }));
  }

  /**
   * Get the "me" info for a connected account.
   */
  async getAccountMe(accountId: string) {
    const client = gramJsPool.getClient(accountId);
    const me = await client.getMe();
    return {
      id: me.id.toString(),
      firstName: me.firstName,
      lastName: me.lastName,
      username: me.username,
      phone: me.phone,
      premium: me.premium,
    };
  }
}

export const accountService = new AccountService();
