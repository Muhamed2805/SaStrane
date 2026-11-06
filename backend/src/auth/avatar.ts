import type { StorageService } from '../storage/storage.service.js';

// Where a profile photo lives in the bucket. Each upload gets a new ID, so
// the file never changes and can be cached for a long time.
export function avatarKey(userId: string, avatarId: string) {
  return `avatars/${userId}/${avatarId}.webp`;
}

export function avatarUrl(
  storage: StorageService,
  user: { id: string; avatarId: string | null },
) {
  return user.avatarId ? storage.url(avatarKey(user.id, user.avatarId)) : null;
}
