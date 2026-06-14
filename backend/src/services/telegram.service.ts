import { PrismaClient } from '@prisma/client';
import { Api } from 'telegram';
import bigInt from 'big-integer';
import { gramJsPool } from '../lib/gramjs-pool';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

/**
 * Input patterns we accept for resolving users/groups:
 * - https://t.me/username
 * - @username
 * - Raw numeric ID (as string)
 */
function parseInput(input: string): { type: 'username' | 'id'; value: string } {
  const trimmed = input.trim();

  // URL format: https://t.me/username
  const urlMatch = trimmed.match(/^https?:\/\/t\.me\/(.+)$/);
  if (urlMatch) {
    return { type: 'username', value: urlMatch[1] };
  }

  // @username format
  if (trimmed.startsWith('@')) {
    return { type: 'username', value: trimmed.substring(1) };
  }

  // Raw numeric ID
  if (/^-?\d+$/.test(trimmed)) {
    return { type: 'id', value: trimmed };
  }

  // Assume it's a username
  return { type: 'username', value: trimmed };
}

/**
 * Telegram Service
 *
 * Handles Telegram-specific operations:
 * - Resolving usernames/IDs to full entities
 * - Deep-fetching user profiles and group info
 * - Scraping group participants
 * - Sending messages (used by broadcast worker)
 */
export class TelegramService {
  /**
   * Resolve a user from input string (username, URL, or ID).
   * Fetches full profile data from Telegram.
   * Uses the first available connected account.
   */
  async resolveUser(input: string, accountId?: string) {
    const client = this.getAvailableClient(accountId);
    const parsed = parseInput(input);

    let entity: any;
    if (parsed.type === 'username') {
      entity = await client.getEntity(parsed.value);
    } else {
      entity = await client.getEntity(parsed.value);
    }

    if (!(entity instanceof Api.User)) {
      throw new Error('Resolved entity is not a user');
    }

    return this.mapUser(entity);
  }

  /**
   * Resolve a group from input string.
   */
  async resolveGroup(input: string, accountId?: string) {
    const client = this.getAvailableClient(accountId);
    const parsed = parseInput(input);

    let entity: any;
    if (parsed.type === 'username') {
      entity = await client.getEntity(parsed.value);
    } else {
      entity = await client.getEntity(parsed.value);
    }

    if (
      !(entity instanceof Api.Chat) &&
      !(entity instanceof Api.Channel)
    ) {
      throw new Error('Resolved entity is not a group or channel');
    }

    return this.mapGroup(entity);
  }

  /**
   * Deep-fetch a user's full profile info.
   */
  async getUserFullInfo(telegramId: bigint, accountId?: string) {
    const client = this.getAvailableClient(accountId);

    try {
      const entity = await client.getEntity(telegramId.toString());
      const fullUser = await client.invoke(
        new Api.users.GetFullUser({ id: entity as any })
      );

      const user = fullUser.users[0] as Api.User;
      const fullInfo = fullUser.fullUser;

      // Get profile photos
      const photos = await client.invoke(
        new Api.photos.GetUserPhotos({
          userId: entity as any,
          offset: 0,
          maxId: bigInt(0),
          limit: 10,
        })
      );

      // Get common chats
      const commonChats = await client.invoke(
        new Api.messages.GetCommonChats({
          userId: entity as any,
          maxId: bigInt(0),
          limit: 100,
        })
      );

      return {
        ...this.mapUser(user),
        bio: fullInfo.about,
        commonChatsCount: fullInfo.commonChatsCount,
        commonChats: (commonChats.chats || []).map((chat: any) => ({
          id: chat.id.toString(),
          title: chat.title,
        })),
        profilePhotosCount: photos instanceof Api.photos.Photos
          ? photos.photos.length
          : (photos as any).count || 0,
        blocked: fullInfo.blocked,
        canPinMessage: fullInfo.canPinMessage,
      };
    } catch (error: any) {
      logger.error(`Failed to fetch full user info for ${telegramId}:`, error);
      throw error;
    }
  }

  /**
   * Deep-fetch group/channel full info.
   */
  async getGroupFullInfo(telegramId: bigint, accountId?: string) {
    const client = this.getAvailableClient(accountId);

    try {
      const entity = await client.getEntity(telegramId.toString());
      const fullChat = await client.invoke(
        new Api.messages.GetFullChat({ chatId: bigInt(telegramId.toString()) })
      );

      return {
        ...this.mapGroup(entity as Api.Chat | Api.Channel),
        about: (fullChat.fullChat as any).about,
        participantsCount: (fullChat.fullChat as any).participantsCount,
        adminsCount: (fullChat.fullChat as any).adminsCount,
        onlineCount: (fullChat.fullChat as any).onlineCount,
      };
    } catch (error: any) {
      logger.error(`Failed to fetch full group info for ${telegramId}:`, error);
      throw error;
    }
  }

  /**
   * Scrape participants from a group.
   * Saves them to the database with proper User-Group relationships.
   */
  async scrapeGroupParticipants(
    groupId: string,
    accountId?: string,
    limit: number = 200
  ) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new Error('Group not found in database');

    const client = this.getAvailableClient(accountId);
    const entity = await client.getEntity(group.telegramId.toString());

    const participants = await client.getParticipants(entity, {
      limit,
    });

    let added = 0;
    let skipped = 0;

    for (const participant of participants) {
      if (participant instanceof Api.User && !participant.bot) {
        try {
          // Upsert the user
          const user = await prisma.user.upsert({
            where: { telegramId: BigInt(participant.id.toString()) },
            create: {
              telegramId: BigInt(participant.id.toString()),
              username: participant.username || null,
              firstName: participant.firstName || null,
              lastName: participant.lastName || null,
              isPremium: participant.premium || false,
              accessHash: participant.accessHash?.toString() || null,
            },
            update: {
              username: participant.username || undefined,
              firstName: participant.firstName || undefined,
              lastName: participant.lastName || undefined,
              isPremium: participant.premium || false,
              accessHash: participant.accessHash?.toString() || undefined,
            },
          });

          // Create the junction record
          await prisma.userGroup.upsert({
            where: {
              userId_groupId: { userId: user.id, groupId: group.id },
            },
            create: { userId: user.id, groupId: group.id },
            update: {},
          });

          added++;
        } catch (error: any) {
          logger.warn(`Failed to save participant:`, {
            userId: participant.id.toString(),
            error: error.message,
          });
          skipped++;
        }
      }
    }

    // Update the group's member count
    await prisma.group.update({
      where: { id: groupId },
      data: { memberCount: participants.length },
    });

    return { total: participants.length, added, skipped };
  }

  /**
   * Send a message to a specific entity (user or group).
   * This is the core send function used by the broadcast worker.
   */
  async sendMessage(
    accountId: string,
    targetTelegramId: bigint,
    options: {
      text?: string;
      parseMode?: string;
      fileId?: string;
    }
  ): Promise<{ messageId: number }> {
    const client = gramJsPool.getClient(accountId);
    const entity = await client.getEntity(targetTelegramId.toString());

    const result = await client.sendMessage(entity, {
      message: options.text || '',
      parseMode: (options.parseMode as any) || 'html',
    });

    return { messageId: result.id };
  }

  /**
   * Get a connected client, preferring the specified accountId.
   * Falls back to the first available connected client.
   */
  private getAvailableClient(accountId?: string) {
    if (accountId) {
      return gramJsPool.getClient(accountId);
    }

    const allClients = gramJsPool.getAllClients();
    if (allClients.size === 0) {
      throw new Error('No connected accounts available');
    }

    return allClients.values().next().value!;
  }

  private mapUser(user: Api.User) {
    return {
      telegramId: BigInt(user.id.toString()),
      username: user.username || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      phone: user.phone || null,
      isBot: user.bot || false,
      isPremium: user.premium || false,
      accessHash: user.accessHash?.toString() || null,
    };
  }

  private mapGroup(entity: Api.Chat | Api.Channel) {
    const isChannel = entity instanceof Api.Channel;
    return {
      telegramId: BigInt(entity.id.toString()),
      title: entity.title,
      username: isChannel ? (entity as Api.Channel).username || null : null,
      type: isChannel
        ? (entity as Api.Channel).megagroup
          ? ('SUPERGROUP' as const)
          : ('CHANNEL' as const)
        : ('GROUP' as const),
      memberCount: isChannel
        ? (entity as Api.Channel).participantsCount || null
        : null,
      accessHash: isChannel
        ? (entity as Api.Channel).accessHash?.toString() || null
        : null,
    };
  }
}

export const telegramService = new TelegramService();
