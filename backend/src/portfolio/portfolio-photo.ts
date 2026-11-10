import type { Prisma } from '../generated/prisma/client.js';
import type { StorageService } from '../storage/storage.service.js';
import type { PortfolioPhotoDto } from './dto/portfolio-photo.dto.js';

export const MAX_PORTFOLIO_PHOTOS = 8;
export const MAX_CAPTION_LENGTH = 120;

export const PORTFOLIO_PHOTO_SELECT = {
  id: true,
  width: true,
  height: true,
  caption: true,
} satisfies Prisma.PortfolioPhotoSelect;

// Lowest position first. Photos added at the same time keep their order.
export const PORTFOLIO_ORDER = [
  { position: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.PortfolioPhotoOrderByWithRelationInput[];

// Where a photo's two files live in the bucket.
export function portfolioKeys(userId: string, photoId: string) {
  const base = `portfolio/${userId}/${photoId}`;
  return { large: `${base}.webp`, thumbnail: `${base}-thumb.webp` };
}

export function allPortfolioKeys(userId: string, photoIds: string[]) {
  return photoIds.flatMap((photoId) => {
    const keys = portfolioKeys(userId, photoId);
    return [keys.large, keys.thumbnail];
  });
}

export function toPortfolioPhotoDto(
  storage: StorageService,
  userId: string,
  photo: Prisma.PortfolioPhotoGetPayload<{
    select: typeof PORTFOLIO_PHOTO_SELECT;
  }>,
): PortfolioPhotoDto {
  const keys = portfolioKeys(userId, photo.id);
  return {
    id: photo.id,
    url: storage.url(keys.large),
    thumbnailUrl: storage.url(keys.thumbnail),
    width: photo.width,
    height: photo.height,
    caption: photo.caption,
  };
}
