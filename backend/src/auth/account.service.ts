import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Prisma } from '../generated/prisma/client.js';
import { SessionRevocationReason } from '../generated/prisma/enums.js';
import { EmailService } from '../email/email.service.js';
import { processAvatar } from '../listings/photos/photo-image.js';
import { photoKeys } from '../listings/photos/photo-keys.js';
import { allPortfolioKeys } from '../portfolio/portfolio-photo.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { avatarKey } from './avatar.js';
import {
  PUBLIC_USER_SELECT,
  toPublicUser,
  type PublicUser,
} from './public-user.js';
import { SessionsService } from './sessions.service.js';

// 400 rather than 401: the client treats a 401 as an ended session and
// would sign the user out.
function wrongPassword() {
  return new BadRequestException({
    code: 'WRONG_PASSWORD',
    message: 'Lozinka nije tačna.',
  });
}

// What a signed-in user changes on their own account.
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly email: EmailService,
    private readonly storage: StorageService,
  ) {}

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        role: dto.role,
        emailNotifications: dto.emailNotifications,
        // An empty introduction removes it.
        bio: dto.bio === undefined ? undefined : dto.bio || null,
        skills: dto.skills && [...new Set(dto.skills)],
        location: dto.location,
      },
      select: PUBLIC_USER_SELECT,
    });
    return toPublicUser(user, this.storage);
  }

  // The new file is stored before the row points to it. The old file is
  // deleted after the row no longer does.
  async setAvatar(userId: string, file: Buffer): Promise<PublicUser> {
    const image = await processAvatar(file);
    const avatarId = randomUUID();
    const key = avatarKey(userId, avatarId);
    await this.storage.put(key, image, 'image/webp');

    try {
      return await this.replaceAvatar(userId, avatarId);
    } catch (error) {
      await this.storage.delete([key]);
      throw error;
    }
  }

  removeAvatar(userId: string): Promise<PublicUser> {
    return this.replaceAvatar(userId, null);
  }

  private async replaceAvatar(userId: string, avatarId: string | null) {
    const { user, previous } = await this.prisma.$transaction(async (tx) => {
      // Two uploads at once take turns, so each one deletes the file the
      // other one replaced and none is left behind.
      const previous = await this.lockUser(tx, userId);
      const user = await tx.user.update({
        where: { id: userId },
        data: { avatarId },
        select: PUBLIC_USER_SELECT,
      });
      return { user, previous };
    });

    if (previous) await this.storage.delete([avatarKey(userId, previous)]);
    return toPublicUser(user, this.storage);
  }

  // Returns the user's current avatar ID.
  private async lockUser(tx: Prisma.TransactionClient, userId: string) {
    const rows = await tx.$queryRaw<{ avatarId: string | null }[]>`
      SELECT "avatarId" FROM "User" WHERE id = ${userId} FOR UPDATE`;
    if (rows.length === 0) throw new UnauthorizedException('User not found');
    return rows[0].avatarId;
  }

  // Ends the user's other sessions, so a device that someone else may be
  // using is signed out. The session that made the change stays.
  async changePassword(
    userId: string,
    sessionId: string,
    dto: ChangePasswordDto,
  ) {
    const user = await this.findWithPassword(userId);
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw wrongPassword();
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      // Matching the old hash makes a concurrent change fail instead of
      // overwriting the other one.
      const result = await tx.user.updateMany({
        where: { id: userId, passwordHash: user.passwordHash },
        data: {
          passwordHash,
          // A reset code that is still open would undo the change.
          passwordResetCodeHash: null,
          passwordResetExpiresAt: null,
          passwordResetSentAt: null,
          passwordResetAttempts: 0,
        },
      });
      if (result.count !== 1) throw wrongPassword();

      await this.sessions.revokeOthers(
        userId,
        sessionId,
        SessionRevocationReason.PASSWORD_CHANGE,
        tx,
      );
    });

    // The password is already changed, so a failed email must not fail the
    // request.
    this.email
      .sendPasswordChanged({ email: user.email, fullName: user.fullName })
      .catch((error: unknown) => {
        this.logger.error(
          `Password change email for ${userId} failed: ${(error as Error).message}`,
        );
      });
  }

  // Deletes the user with their jobs, applications, conversations and
  // ratings, then the photo files of their jobs, their gallery and their
  // profile photo.
  async deleteAccount(userId: string, password: string) {
    const user = await this.findWithPassword(userId);
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw wrongPassword();
    }

    const { photos, portfolio } = await this.prisma.$transaction(async (tx) => {
      const found = await tx.listingPhoto.findMany({
        where: { listing: { clientId: userId } },
        select: { id: true, listingId: true },
      });
      const gallery = await tx.portfolioPhoto.findMany({
        where: { userId },
        select: { id: true },
      });
      await tx.user.delete({ where: { id: userId } });
      return { photos: found, portfolio: gallery };
    });

    await this.storage.delete([
      ...photos.flatMap((photo) => {
        const keys = photoKeys(photo.listingId, photo.id);
        return [keys.large, keys.thumbnail];
      }),
      ...allPortfolioKeys(
        userId,
        portfolio.map((photo) => photo.id),
      ),
      ...(user.avatarId ? [avatarKey(userId, user.avatarId)] : []),
    ]);
  }

  private async findWithPassword(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        fullName: true,
        passwordHash: true,
        avatarId: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
