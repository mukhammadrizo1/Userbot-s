import { TelegramClient, Api } from 'telegram';
import { ConnectionTCPObfuscated } from 'telegram/network/connection';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { PrismaClient, AccountStatus } from '@prisma/client';
import { config } from '../config';
import { encrypt, decrypt } from './encryption';
import { logger } from './logger';

const prisma = new PrismaClient();

export interface AccountInfo {
  id: string;
  phone: string;
  telegramId: bigint | null;
  firstName: string | null;
  username: string | null;
  status: AccountStatus;
  isActive: boolean;
}

export interface AuthFlowState {
  accountId: string;
  phone: string;
  phoneCodeHash: string;
  client: TelegramClient;
}

/**
 * GramJS Session Pool
 *
 * Manages multiple concurrent Telegram userbot connections.
 * Each account gets its own isolated TelegramClient instance with:
 * - An encrypted StringSession persisted in PostgreSQL
 * - Event handlers for new messages
 * - Automatic reconnection on network failures
 *
 * Key invariants:
 * - One TelegramClient per account (no sharing)
 * - Sessions encrypted at rest (AES-256-GCM)
 * - Graceful disconnect on shutdown
 */
export class GramJSPool {
  private clients: Map<string, TelegramClient> = new Map();
  private pendingAuths: Map<string, AuthFlowState> = new Map();
  private messageHandler?: (
    accountId: string,
    event: NewMessageEvent
  ) => void;

  /**
   * Register a handler that will be called for every new message
   * received by any connected account.
   */
  onNewMessage(
    handler: (accountId: string, event: NewMessageEvent) => void
  ): void {
    this.messageHandler = handler;
  }

  /**
   * Connect all active accounts from the database on server startup.
   */
  async connectAll(): Promise<void> {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
    });

    logger.info(`Connecting ${accounts.length} saved accounts...`);

    for (const account of accounts) {
      try {
        await this.connectAccount(account.id);
        logger.info(`✅ Connected account: ${account.phone}`);
      } catch (error: any) {
        logger.error(`❌ Failed to connect account ${account.phone}:`, {
          error: error.message,
        });
        await prisma.account.update({
          where: { id: account.id },
          data: { status: 'DISCONNECTED' },
        });
      }
    }
  }

  /**
   * Connect a single account by its database ID.
   * Decrypts the session string and initializes a TelegramClient.
   */
  async connectAccount(accountId: string): Promise<void> {
    if (this.clients.has(accountId)) {
      logger.warn(`Account ${accountId} is already connected`);
      return;
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Decrypt the session string
    let sessionString = '';
    if (account.sessionString) {
      try {
        sessionString = decrypt(
          account.sessionString,
          config.encryptionMasterKey
        );
      } catch {
        logger.error(`Failed to decrypt session for account ${accountId}`);
        throw new Error('Failed to decrypt session. Check encryption key.');
      }
    }

    const session = new StringSession(sessionString);
    const client = new TelegramClient(
      session,
      config.telegramApiId,
      config.telegramApiHash,
      {
        connectionRetries: 5,
        retryDelay: 1000,
        autoReconnect: true,
        useWSS: true,
        connection: ConnectionTCPObfuscated,
      }
    );

    await client.connect();

    // Verify the session is still valid
    if (!(await client.checkAuthorization())) {
      await prisma.account.update({
        where: { id: accountId },
        data: { status: 'AUTH_REQUIRED' },
      });
      throw new Error('Session expired. Re-authentication required.');
    }

    // Register event handlers
    this.registerEventHandlers(accountId, client);

    // Store in the pool
    this.clients.set(accountId, client);

    // Update DB status
    await prisma.account.update({
      where: { id: accountId },
      data: {
        status: 'CONNECTED',
        lastConnectedAt: new Date(),
      },
    });
  }

  /**
   * Start the authentication flow for a new account.
   * Returns the account ID and prompts for the verification code.
   */
  async addAccount(
    phone: string
  ): Promise<{ accountId: string; phoneCodeHash: string }> {
    // Check if account already exists
    const existing = await prisma.account.findUnique({ where: { phone } });
    if (existing) {
      throw new Error(`Account with phone ${phone} already exists`);
    }

    const session = new StringSession('');
    const client = new TelegramClient(
      session,
      config.telegramApiId,
      config.telegramApiHash,
      {
        connectionRetries: 5,
        useWSS: true,
        connection: ConnectionTCPObfuscated,
      }
    );

    await client.connect();

    // Send the code
    const result = await client.sendCode(
      { apiId: config.telegramApiId, apiHash: config.telegramApiHash },
      phone
    );

    // Create account record in DB (session will be filled after auth)
    const account = await prisma.account.create({
      data: {
        phone,
        sessionString: '',
        status: 'AUTH_REQUIRED',
      },
    });

    // Store the pending auth state
    this.pendingAuths.set(account.id, {
      accountId: account.id,
      phone,
      phoneCodeHash: result.phoneCodeHash,
      client,
    });

    return {
      accountId: account.id,
      phoneCodeHash: result.phoneCodeHash,
    };
  }

  /**
   * Submit the verification code for a pending authentication.
   * Returns true if successful, or throws if 2FA is required.
   */
  async submitCode(
    accountId: string,
    code: string
  ): Promise<{ success: boolean; needs2FA: boolean }> {
    const authState = this.pendingAuths.get(accountId);
    if (!authState) {
      throw new Error('No pending authentication for this account');
    }

    try {
      const result = await authState.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: authState.phone,
          phoneCodeHash: authState.phoneCodeHash,
          phoneCode: code,
        })
      );

      // Success — finalize the account
      await this.finalizeAuth(accountId, authState.client);
      return { success: true, needs2FA: false };
    } catch (error: any) {
      if (error.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        return { success: false, needs2FA: true };
      }
      throw error;
    }
  }

  /**
   * Submit the 2FA password for a pending authentication.
   */
  async submit2FA(accountId: string, password: string): Promise<boolean> {
    const authState = this.pendingAuths.get(accountId);
    if (!authState) {
      throw new Error('No pending authentication for this account');
    }

    const passwordInfo = await authState.client.invoke(
      new Api.account.GetPassword()
    );

    const result = await authState.client.invoke(
      new Api.auth.CheckPassword({
        password: await (authState.client as any)._computePasswordSRP(
          passwordInfo,
          password
        ),
      })
    );

    // Success
    await this.finalizeAuth(accountId, authState.client);
    return true;
  }

  /**
   * Finalize authentication: save encrypted session, update DB, register events.
   */
  private async finalizeAuth(
    accountId: string,
    client: TelegramClient
  ): Promise<void> {
    // Get user info
    const me = await client.getMe();

    // Save encrypted session string
    const sessionString = (client.session as StringSession).save();
    const encryptedSession = encrypt(sessionString, config.encryptionMasterKey);

    // Update the account in DB
    await prisma.account.update({
      where: { id: accountId },
      data: {
        sessionString: encryptedSession,
        telegramId: BigInt(me.id.toString()),
        firstName: me.firstName || null,
        lastName: me.lastName || null,
        username: me.username || null,
        status: 'CONNECTED',
        lastConnectedAt: new Date(),
      },
    });

    // Register event handlers
    this.registerEventHandlers(accountId, client);

    // Move from pending to active
    this.pendingAuths.delete(accountId);
    this.clients.set(accountId, client);

    logger.info(`✅ Account ${accountId} authenticated successfully`, {
      phone: me.phone,
      username: me.username,
    });
  }

  /**
   * Register event handlers for new messages on a client.
   */
  private registerEventHandlers(
    accountId: string,
    client: TelegramClient
  ): void {
    client.addEventHandler(
      (event: NewMessageEvent) => {
        if (this.messageHandler) {
          try {
            this.messageHandler(accountId, event);
          } catch (error) {
            logger.error('Error in message handler:', error);
          }
        }
      },
      new NewMessage({})
    );
  }

  /**
   * Disconnect a specific account.
   */
  async disconnectAccount(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    if (client) {
      try {
        await client.disconnect();
      } catch (error) {
        logger.warn(`Error disconnecting account ${accountId}:`, error);
      }
      this.clients.delete(accountId);
    }

    await prisma.account.update({
      where: { id: accountId },
      data: { status: 'DISCONNECTED' },
    });
  }

  /**
   * Remove an account entirely — disconnect and delete from DB.
   */
  async removeAccount(accountId: string): Promise<void> {
    await this.disconnectAccount(accountId);
    await prisma.account.delete({ where: { id: accountId } });
    logger.info(`Account ${accountId} removed`);
  }

  /**
   * Get a TelegramClient for a specific account.
   * Throws if the account is not connected.
   */
  getClient(accountId: string): TelegramClient {
    const client = this.clients.get(accountId);
    if (!client) {
      throw new Error(`Account ${accountId} is not connected`);
    }
    return client;
  }

  /**
   * Get all connected client entries.
   */
  getAllClients(): Map<string, TelegramClient> {
    return this.clients;
  }

  /**
   * Check if a specific account is connected.
   */
  isConnected(accountId: string): boolean {
    return this.clients.has(accountId);
  }

  /**
   * Get status info for all accounts (for dashboard display).
   */
  async getAllAccountStatuses(): Promise<AccountInfo[]> {
    const accounts = await prisma.account.findMany({
      select: {
        id: true,
        phone: true,
        telegramId: true,
        firstName: true,
        username: true,
        status: true,
        isActive: true,
      },
    });

    return accounts;
  }

  /**
   * Graceful shutdown — disconnect all clients.
   */
  async disconnectAll(): Promise<void> {
    logger.info(
      `Disconnecting ${this.clients.size} accounts for shutdown...`
    );
    const promises = Array.from(this.clients.keys()).map((id) =>
      this.disconnectAccount(id)
    );
    await Promise.allSettled(promises);
    logger.info('All accounts disconnected');
  }
}

// Singleton instance
export const gramJsPool = new GramJSPool();
