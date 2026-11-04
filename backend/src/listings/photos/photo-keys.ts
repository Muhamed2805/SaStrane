import type { StorageService } from '../../storage/storage.service.js';
import type { ListingPhotoDto } from './dto/listing-photo-response.dto.js';

// Where a photo's two files live in the bucket.
export function photoKeys(listingId: string, photoId: string) {
  const base = `listings/${listingId}/${photoId}`;
  return { large: `${base}.webp`, thumbnail: `${base}-thumb.webp` };
}

export function allPhotoKeys(listingId: string, photoIds: string[]) {
  return photoIds.flatMap((photoId) => {
    const keys = photoKeys(listingId, photoId);
    return [keys.large, keys.thumbnail];
  });
}

export function toPhotoDto(
  storage: StorageService,
  listingId: string,
  photo: { id: string; width: number; height: number },
): ListingPhotoDto {
  const keys = photoKeys(listingId, photo.id);
  return {
    id: photo.id,
    url: storage.url(keys.large),
    thumbnailUrl: storage.url(keys.thumbnail),
    width: photo.width,
    height: photo.height,
  };
}
