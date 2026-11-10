import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { processPhoto } from '../listings/photos/photo-image.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import {
  allPortfolioKeys,
  MAX_PORTFOLIO_PHOTOS,
  PORTFOLIO_PHOTO_SELECT,
  portfolioKeys,
  toPortfolioPhotoDto,
} from './portfolio-photo.js';

function portfolioFull() {
  return new ConflictException({
    code: 'PORTFOLIO_LIMIT_REACHED',
    message: `Galerija može imati najviše ${MAX_PORTFOLIO_PHOTOS} slika.`,
  });
}

// An empty caption is stored as none.
function captionValue(caption: string | undefined) {
  return caption ? caption : null;
}

// The photos of work a user has done, on their public profile.
@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // The files are stored before the row, so a listed photo always has its
  // files. When the row cannot be written, the files are deleted again.
  async add(userId: string, file: Buffer, caption?: string) {
    // Checked again below under a lock. This check spares the image work
    // when the gallery is already full.
    const count = await this.prisma.portfolioPhoto.count({
      where: { userId },
    });
    if (count >= MAX_PORTFOLIO_PHOTOS) throw portfolioFull();

    const image = await processPhoto(file);
    const id = randomUUID();
    const keys = portfolioKeys(userId, id);
    await Promise.all([
      this.storage.put(keys.large, image.large.data, 'image/webp'),
      this.storage.put(keys.thumbnail, image.thumbnail, 'image/webp'),
    ]);

    try {
      const photo = await this.prisma.$transaction(async (tx) => {
        await this.lockUser(tx, userId);
        const existing = await tx.portfolioPhoto.aggregate({
          where: { userId },
          _count: true,
          _max: { position: true },
        });
        if (existing._count >= MAX_PORTFOLIO_PHOTOS) throw portfolioFull();

        return tx.portfolioPhoto.create({
          data: {
            id,
            userId,
            position: (existing._max.position ?? -1) + 1,
            width: image.large.width,
            height: image.large.height,
            caption: captionValue(caption),
          },
          select: PORTFOLIO_PHOTO_SELECT,
        });
      });
      return toPortfolioPhotoDto(this.storage, userId, photo);
    } catch (error) {
      await this.storage.delete([keys.large, keys.thumbnail]);
      throw error;
    }
  }

  async updateCaption(userId: string, photoId: string, caption?: string) {
    const { count } = await this.prisma.portfolioPhoto.updateMany({
      where: { id: photoId, userId },
      data: { caption: captionValue(caption) },
    });
    if (count === 0) throw new NotFoundException('Photo not found');

    const photo = await this.prisma.portfolioPhoto.findUniqueOrThrow({
      where: { id: photoId },
      select: PORTFOLIO_PHOTO_SELECT,
    });
    return toPortfolioPhotoDto(this.storage, userId, photo);
  }

  async remove(userId: string, photoId: string) {
    const { count } = await this.prisma.portfolioPhoto.deleteMany({
      where: { id: photoId, userId },
    });
    if (count === 0) throw new NotFoundException('Photo not found');

    await this.storage.delete(allPortfolioKeys(userId, [photoId]));
  }

  // Serializes the uploads of one user, so two at once cannot pass the
  // limit together.
  private async lockUser(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  }
}
