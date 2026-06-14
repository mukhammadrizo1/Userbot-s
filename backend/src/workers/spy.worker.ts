import { Worker, Job, Queue } from 'bullmq';
import IORedis from 'bullmq/node_modules/ioredis';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { telegramService } from '../services/telegram.service';
import { logger } from '../lib/logger';
import Groq from 'groq-sdk';

const prisma = new PrismaClient();
const groq = new Groq({ apiKey: config.groqApiKey });

export interface SpyLLMJobData {
  ticketId: string;
  groupId: string;
  telegramMsgId: number;
  messageText: string;
  senderTelegramId: string;
  senderUsername?: string;
  senderFirstName?: string;
  senderLastName?: string;
  sentAt: Date;
}

export const llmQueue = new Queue<SpyLLMJobData>('llm-analysis', {
  connection: new IORedis(config.redisUrl, { maxRetriesPerRequest: null }),
});

export function initSpyWorker(): Worker {
  const redisConnection = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<SpyLLMJobData>(
    'llm-analysis',
    async (job: Job<SpyLLMJobData>) => {
      const data = job.data;
      logger.info(`Processing Spy Job for Ticket ${data.ticketId}, Message ${data.telegramMsgId}`);

      const ticket = await prisma.spyTicket.findUnique({ where: { id: data.ticketId } });
      if (!ticket || ticket.status !== 'RUNNING' || ticket.isDeleted) {
        logger.info(`Ticket ${data.ticketId} is no longer active. Skipping.`);
        return;
      }

      // 1. Build Context
      const prompt = `${ticket.aiPrompt}\n\nMessage context:\n"${data.messageText}"\n\nAnalyze the text. Answer with strictly one word: 'Yes' or 'No'.`;

      // 2. Call Groq LLM
      try {
        const completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama3-8b-8192", // or llama3-70b-8192
          temperature: 0,
          max_tokens: 5,
        });

        const responseText = completion.choices[0]?.message?.content || '';
        logger.info(`LLM Response for Ticket ${ticket.id}: ${responseText}`);

        // Extract "yes" using regex as per user instructions
        const isMatch = /\byes\b/i.test(responseText);

        if (isMatch) {
          logger.info(`Match found! Capturing lead for User ${data.senderTelegramId}`);

          // Ensure group exists
          const group = await prisma.group.findUnique({ where: { telegramId: BigInt(data.groupId) } });
          if (!group) {
             logger.warn(`Group ${data.groupId} not found in DB. Skipping lead capture.`);
             return;
          }

          // Ensure user exists (Upsert)
          const user = await prisma.user.upsert({
            where: { telegramId: BigInt(data.senderTelegramId) },
            create: {
              telegramId: BigInt(data.senderTelegramId),
              username: data.senderUsername,
              firstName: data.senderFirstName,
              lastName: data.senderLastName,
            },
            update: {
              username: data.senderUsername,
              firstName: data.senderFirstName,
              lastName: data.senderLastName,
            }
          });

          // Ensure ScrapedMessage exists
          const scrapedMessage = await prisma.scrapedMessage.upsert({
            where: {
              groupId_telegramMsgId: {
                groupId: group.id,
                telegramMsgId: data.telegramMsgId
              }
            },
            create: {
              groupId: group.id,
              userId: user.id,
              telegramMsgId: data.telegramMsgId,
              messageText: data.messageText,
              sentAt: new Date(data.sentAt)
            },
            update: {}
          });

          // Create CapturedLead (Idempotency: unique on ticketId + userId)
          let lead = await prisma.capturedLead.findUnique({
             where: { ticketId_userId: { ticketId: ticket.id, userId: user.id } }
          });

          if (!lead) {
            lead = await prisma.capturedLead.create({
              data: {
                ticketId: ticket.id,
                userId: user.id,
                groupId: group.id,
                messageId: scrapedMessage.id,
                autoReplySent: false
              }
            });

            // 3. Auto-Reply Logic
            if (ticket.autoReplyMessage) {
               logger.info(`Sending auto-reply to ${user.telegramId}`);
               try {
                 // Try to get any active account
                 const accounts = await prisma.account.findMany({ where: { status: 'CONNECTED' }});
                 if(accounts.length > 0) {
                     await telegramService.sendMessage(accounts[0].id, user.telegramId, {
                       text: ticket.autoReplyMessage
                     });
                     
                     await prisma.capturedLead.update({
                       where: { id: lead.id },
                       data: { autoReplySent: true }
                     });
                     logger.info(`Auto-reply sent successfully to ${user.telegramId}`);
                 } else {
                     logger.warn(`No connected accounts available for auto-reply.`);
                 }
               } catch (err: any) {
                 logger.error(`Auto-reply failed for user ${user.telegramId}: ${err.message}`);
               }
            }
          } else {
             logger.info(`Lead for user ${user.id} already captured for ticket ${ticket.id}. Updating message reference maybe? Skipping auto-reply.`);
          }
        }
      } catch (error: any) {
        logger.error(`Groq API error: ${error.message}`);
        throw error; // Will be retried by BullMQ
      }
    },
    {
      connection: redisConnection,
      concurrency: 5, // Process up to 5 LLM requests concurrently
    }
  );

  worker.on('failed', (job, error) => {
    logger.error(`LLM Analysis job failed:`, {
      jobId: job?.id,
      error: error.message,
    });
  });

  logger.info('🤖 LLM Spy worker initialized');
  return worker;
}
