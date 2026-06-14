import { Worker, Job } from 'bullmq';
import IORedis from 'bullmq/node_modules/ioredis';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { telegramService } from '../services/telegram.service';
import { logger } from '../lib/logger';
import { Server as SocketIOServer } from 'socket.io';

const prisma = new PrismaClient();

interface ScrapeJobData {
  scrapeJobId: string;
  accountId?: string;
  targetGroups: Array<{ id: string, telegramId: string, title: string }>;
  limitPerGroup: number;
}

let io: SocketIOServer | null = null;

export function setScraperSocketIO(socketIO: SocketIOServer): void {
  io = socketIO;
}

function emitProgress(jobId: string, data: any): void {
  if (io) {
    io.to(`scraper:${jobId}`).emit('scraper:progress', { jobId, ...data });
  }
}

export function initScraperWorker(): Worker {
  const redisConnection = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<ScrapeJobData>(
    'scraper',
    async (job: Job<ScrapeJobData>) => {
      const { scrapeJobId, accountId, targetGroups, limitPerGroup } = job.data;
      
      logger.info(`Starting scraper job ${scrapeJobId} for ${targetGroups.length} groups`);
      
      let totalAdded = 0;
      let totalSkipped = 0;

      for (let i = 0; i < targetGroups.length; i++) {
        const group = targetGroups[i];
        
        emitProgress(scrapeJobId, {
          status: 'SCRAPING',
          currentGroupIndex: i,
          totalGroups: targetGroups.length,
          currentGroupTitle: group.title,
          totalAdded,
          totalSkipped
        });

        try {
          const result = await telegramService.scrapeGroupParticipants(group.id, accountId, limitPerGroup);
          totalAdded += result.added;
          totalSkipped += result.skipped;
          logger.info(`Scraped ${group.title}: ${result.added} added, ${result.skipped} skipped`);
        } catch (error: any) {
          logger.error(`Failed to scrape group ${group.title}:`, error);
          // Don't throw, continue to next group
        }
        
        // Random delay between groups to avoid flood limits
        if (i < targetGroups.length - 1) {
          const delay = Math.floor(Math.random() * 5000) + 5000; // 5-10s delay
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      emitProgress(scrapeJobId, {
        status: 'COMPLETED',
        totalGroups: targetGroups.length,
        currentGroupIndex: targetGroups.length,
        totalAdded,
        totalSkipped
      });

      logger.info(`Completed scraper job ${scrapeJobId}. Total added: ${totalAdded}`);
      return { totalAdded, totalSkipped };
    },
    {
      connection: redisConnection,
      concurrency: 1, // Be nice to telegram API
    }
  );

  worker.on('failed', (job, error) => {
    logger.error(`Scraper worker job failed:`, {
      jobId: job?.id,
      error: error.message,
    });
  });

  logger.info('🕵️ Scraper worker initialized');
  return worker;
}
