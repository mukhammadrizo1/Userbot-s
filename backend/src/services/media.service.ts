import { Telegraf, Context } from 'telegraf';
import {
  PrismaClient,
  MediaType,
} from '@prisma/client';
import { config } from '../config';
import { logger } from '../lib/logger';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/**
 * Media Service
 *
 * Handles the zero-budget media storage strategy:
 * 1. Receive file upload from frontend
 * 2. Forward to a private Telegram channel via Bot API
 * 3. Store only the file_id in our database
 * 4. Retrieve media using the stored file_id
 */
export class MediaService {
  private bot: Telegraf;

  constructor() {
    this.bot = new Telegraf(config.botToken);
  }

  /**
   * Upload a file to the private Telegram channel.
   * Returns the created MediaAsset record.
   */
  async uploadMedia(
    filePath: string,
    fileName: string,
    mimeType: string,
    caption?: string
  ) {
    const fileType = this.detectMediaType(mimeType);

    try {
      let message;
      const source = fs.createReadStream(filePath);

      switch (fileType) {
        case 'PHOTO':
          message = await this.bot.telegram.sendPhoto(
            config.mediaChannelId,
            { source, filename: fileName },
            { caption: caption || fileName }
          );
          break;

        case 'VIDEO':
          message = await this.bot.telegram.sendVideo(
            config.mediaChannelId,
            { source, filename: fileName },
            { caption: caption || fileName }
          );
          break;

        case 'AUDIO':
          message = await this.bot.telegram.sendAudio(
            config.mediaChannelId,
            { source, filename: fileName },
            { caption: caption || fileName }
          );
          break;

        case 'ANIMATION':
          message = await this.bot.telegram.sendAnimation(
            config.mediaChannelId,
            { source, filename: fileName },
            { caption: caption || fileName }
          );
          break;

        default:
          message = await this.bot.telegram.sendDocument(
            config.mediaChannelId,
            { source, filename: fileName },
            { caption: caption || fileName }
          );
          break;
      }

      // Extract file_id from the response
      const fileInfo = this.extractFileInfo(message, fileType);

      // Save to database
      const asset = await prisma.mediaAsset.create({
        data: {
          fileId: fileInfo.fileId,
          fileUniqueId: fileInfo.fileUniqueId,
          fileType: fileType as MediaType,
          fileName,
          mimeType,
          fileSize: fileInfo.fileSize,
          caption,
          channelMsgId: message.message_id,
          thumbnailFileId: fileInfo.thumbnailFileId || null,
        },
      });

      // Clean up temp file
      try {
        fs.unlinkSync(filePath);
      } catch {
        logger.warn(`Failed to cleanup temp file: ${filePath}`);
      }

      logger.info(`Media uploaded: ${asset.id} (${fileType})`, {
        fileName,
        fileId: fileInfo.fileId.substring(0, 20) + '...',
      });

      return asset;
    } catch (error: any) {
      // Clean up temp file on error too
      try {
        fs.unlinkSync(filePath);
      } catch {}
      logger.error('Media upload failed:', error);
      throw error;
    }
  }

  /**
   * Get a temporary download URL for a media asset.
   */
  async getMediaUrl(assetId: string): Promise<string> {
    const asset = await prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new Error('Media asset not found');
    }

    const fileLink = await this.bot.telegram.getFileLink(asset.fileId);
    return fileLink.toString();
  }

  /**
   * List all media assets with pagination.
   */
  async listMedia(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [assets, total] = await Promise.all([
      prisma.mediaAsset.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.mediaAsset.count(),
    ]);

    return {
      assets,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Delete a media asset from the database.
   * Note: We don't delete from Telegram channel (it stays as storage).
   */
  async deleteMedia(assetId: string) {
    return prisma.mediaAsset.delete({ where: { id: assetId } });
  }

  /**
   * Detect media type from MIME type.
   */
  private detectMediaType(mimeType: string): string {
    if (mimeType.startsWith('image/gif')) return 'ANIMATION';
    if (mimeType.startsWith('image/')) return 'PHOTO';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    return 'DOCUMENT';
  }

  /**
   * Extract file info from a Telegram message response.
   */
  private extractFileInfo(
    message: any,
    fileType: string
  ): {
    fileId: string;
    fileUniqueId: string;
    fileSize?: number;
    thumbnailFileId?: string;
  } {
    let file;

    switch (fileType) {
      case 'PHOTO':
        // Photos have multiple sizes; get the largest
        const photos = message.photo;
        file = photos[photos.length - 1];
        break;
      case 'VIDEO':
        file = message.video;
        break;
      case 'AUDIO':
        file = message.audio;
        break;
      case 'ANIMATION':
        file = message.animation;
        break;
      default:
        file = message.document;
        break;
    }

    return {
      fileId: file.file_id,
      fileUniqueId: file.file_unique_id,
      fileSize: file.file_size,
      thumbnailFileId: file.thumbnail?.file_id || file.thumb?.file_id,
    };
  }
}

export const mediaService = new MediaService();
