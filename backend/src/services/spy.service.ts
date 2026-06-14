import { PrismaClient } from '@prisma/client';
import { llmQueue } from '../workers/spy.worker';
import { logger } from '../lib/logger';
import { Api } from 'telegram';

const prisma = new PrismaClient();

// In-memory cache for active spy tickets to avoid hitting DB on every single message
// Cache structure: Map<groupId, Array<Ticket>>
let spyTicketsCache: Map<string, any[]> = new Map();
let lastCacheUpdate = 0;
const CACHE_TTL = 60000; // 1 minute

async function refreshSpyTicketsCache() {
  if (Date.now() - lastCacheUpdate < CACHE_TTL) return;

  try {
    const activeTickets = await prisma.spyTicket.findMany({
      where: { status: 'RUNNING', isDeleted: false },
      include: { targets: true }
    });

    const newCache = new Map<string, any[]>();
    for (const ticket of activeTickets) {
      // Create regex from pipe-separated keywords
      const regexPattern = ticket.keywords.split('|').map(k => k.trim()).filter(Boolean).join('|');
      const regex = regexPattern ? new RegExp(`(${regexPattern})`, 'i') : null;
      
      const ticketCacheData = {
        id: ticket.id,
        regex
      };

      for (const target of ticket.targets) {
        if (target.groupId) {
          const groupIdStr = target.groupId;
          const groupTickets = newCache.get(groupIdStr) || [];
          groupTickets.push(ticketCacheData);
          newCache.set(groupIdStr, groupTickets);
        }
        // TODO: Handle category targets
      }
    }
    
    spyTicketsCache = newCache;
    lastCacheUpdate = Date.now();
  } catch (err) {
    logger.error('Failed to refresh SpyTickets cache:', err);
  }
}

export async function dispatchMessageToSpy(message: Api.Message) {
  if (!message.isGroup || !message.text) return;
  
  // Fire and forget cache refresh (non-blocking)
  refreshSpyTicketsCache().catch(() => {});

  try {
    // 1. Resolve Group ID from Telegram ID
    // message.chatId is usually a big integer, but gramjs uses string or BigInt. 
    // We need to match it with our Group model's telegramId.
    const telegramChatId = message.chatId?.toString();
    if (!telegramChatId) return;

    // Fast check: Is this group monitored by ANY ticket?
    // We need the internal DB groupId to check the cache, or we store by telegramChatId in cache.
    // Let's store by internal groupId, so we need to map telegramChatId -> DB Group ID.
    // To keep it super fast, we can just do a single DB query to find the group and its tickets.
    const group = await prisma.group.findUnique({
      where: { telegramId: BigInt(telegramChatId) },
      include: {
        spyTicketTargets: {
          include: { ticket: true }
        }
      }
    });

    if (!group) return;

    const activeTickets = group.spyTicketTargets
      .map(t => t.ticket)
      .filter(t => t.status === 'RUNNING' && !t.isDeleted);

    if (activeTickets.length === 0) return;

    const msgText = message.text;

    // 2. Check Keywords
    for (const ticket of activeTickets) {
      const keywords = ticket.keywords.split('|').map(k => k.trim()).filter(Boolean);
      let matchFound = false;

      for (const kw of keywords) {
        if (new RegExp(`\\b${kw}\\b`, 'i').test(msgText)) {
          matchFound = true;
          break;
        }
      }

      // 3. If matched, push to BullMQ
      if (matchFound) {
        const sender = await message.getSender() as any;
        
        await llmQueue.add('analyze', {
          ticketId: ticket.id,
          groupId: group.telegramId.toString(),
          telegramMsgId: message.id,
          messageText: msgText,
          senderTelegramId: sender?.id?.toString() || '0',
          senderUsername: sender?.username,
          senderFirstName: sender?.firstName,
          senderLastName: sender?.lastName,
          sentAt: new Date(message.date * 1000)
        });
        
        logger.info(`Dispatched message ${message.id} to LLM queue for Ticket ${ticket.id}`);
      }
    }
  } catch (error: any) {
    logger.error('Error dispatching message to spy queue:', error.message);
  }
}
