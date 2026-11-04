import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { MAX_PHOTOS_PER_LISTING, processPhoto } from './photo-image.js';
import { allPhotoKeys, photoKeys, toPhotoDto } from './photo-keys.js';

const PHOTO_SELECT = {
  id: true,
  width: true,
  height: true,
} satisfies Prisma.ListingPhotoSelect;

// Lowest position first. Photos added at the same time keep their order.
export const PHOTO_ORDER = [
  { position: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.ListingPhotoOrderByWithRelationInput[];

function photoLimitReached() {
  return new ConflictException({
    code: 'PHOTO_LIMIT_REACHED',
    message: `Oglas može imati najviše ${MAX_PHOTOS_PER_LISTING} slika.`,
  });
}

@Injectable()
export class ListingPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // The files are stored before the row, so a listed photo always has its
  // files. When the row cannot be written, the files are deleted again.
  async add(listingId: string, userId: string, file: Buffer) {
    await this.assertOwner(listingId, userId);
    // Checked again below under a lock. This check spares the image work
    // when the job is already full.
    const count = await this.prisma.listingPhoto.count({
      where: { listingId },
    });
    if (count >= MAX_PHOTOS_PER_LISTING) throw photoLimitReached();

    const image = await processPhoto(file);
    const id = randomUUID();
    const keys = photoKeys(listingId, id);
    await Promise.all([
      this.storage.put(keys.large, image.large.data, 'image/webp'),
      this.storage.put(keys.thumbnail, image.thumbnail, 'image/webp'),
    ]);

    try {
      const photo = await this.prisma.$transaction(async (tx) => {
        await this.lockListing(tx, listingId);
        const existing = await tx.listingPhoto.aggregate({
          where: { listingId },
          _count: true,
          _max: { position: true },
        });
        if (existing._count >= MAX_PHOTOS_PER_LISTING) {
          throw photoLimitReached();
        }

        return tx.listingPhoto.create({
          data: {
            id,
            listingId,
            position: (existing._max.position ?? -1) + 1,
            width: image.large.width,
            height: image.large.height,
          },
          select: PHOTO_SELECT,
        });
      });
      return toPhotoDto(this.storage, listingId, photo);
    } catch (error) {
      await this.storage.delete([keys.large, keys.thumbnail]);
      throw error;
    }
  }

  async remove(listingId: string, photoId: string, userId: string) {
    await this.assertOwner(listingId, userId);

    const { count } = await this.prisma.listingPhoto.deleteMany({
      where: { id: photoId, listingId },
    });
    if (count === 0) throw new NotFoundException('Photo not found');

    await this.storage.delete(allPhotoKeys(listingId, [photoId]));
  }

  // `photoIds` must name every photo of the job exactly once.
  async reorder(listingId: string, photoIds: string[], userId: string) {
    await this.assertOwner(listingId, userId);

    const photos = await this.prisma.$transaction(async (tx) => {
      await this.lockListing(tx, listingId);
      const current = await tx.listingPhoto.findMany({
        where: { listingId },
        select: { id: true },
      });
      const currentIds = new Set(current.map((photo) => photo.id));
      if (
        photoIds.length !== currentIds.size ||
        photoIds.some((id) => !currentIds.has(id))
      ) {
        throw new BadRequestException(
          'photoIds must list every photo of the job once',
        );
      }

      await Promise.all(
        photoIds.map((id, position) =>
          tx.listingPhoto.update({ where: { id }, data: { position } }),
        ),
      );
      return tx.listingPhoto.findMany({
        where: { listingId },
        orderBy: PHOTO_ORDER,
        select: PHOTO_SELECT,
      });
    });

    return photos.map((photo) => toPhotoDto(this.storage, listingId, photo));
  }

  // Serializes the photo changes of one job, so two uploads at once cannot
  // pass the limit together.
  private async lockListing(tx: Prisma.TransactionClient, listingId: string) {
    await tx.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listingId} FOR UPDATE`;
  }

  private async assertOwner(listingId: string, userId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      select: { clientId: true },
    });

    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.clientId !== userId) {
      throw new ForbiddenException('Not your listing');
    }
  }
}
