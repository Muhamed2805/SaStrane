import { Prisma } from '../generated/prisma/client.js';
import type { StorageService } from '../storage/storage.service.js';
import { avatarUrl } from './avatar.js';

// The user fields that the signed-in user gets about themselves.
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  emailNotifications: true,
  bio: true,
  skills: true,
  avatarId: true,
  isAdmin: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUserRow = Prisma.UserGetPayload<{
  select: typeof PUBLIC_USER_SELECT;
}>;

// The shape of PublicUserDto: the avatar as a URL instead of its ID.
export type PublicUser = Omit<PublicUserRow, 'avatarId'> & {
  avatarUrl: string | null;
};

// Lists the fields one by one, so a row with more fields cannot leak them.
export function toPublicUser(
  user: PublicUserRow,
  storage: StorageService,
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    emailNotifications: user.emailNotifications,
    bio: user.bio,
    skills: user.skills,
    avatarUrl: avatarUrl(storage, user),
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  };
}
