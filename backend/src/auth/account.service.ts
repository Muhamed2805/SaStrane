import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcrypt';
import { SessionRevocationReason } from '../generated/prisma/enums.js';
import { EmailService } from '../email/email.service.js';
import { photoKeys } from '../listings/photos/photo-keys.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { PUBLIC_USER_SELECT, type PublicUser } from './public-user.js';
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

  updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { fullName: dto.fullName, role: dto.role },
      select: PUBLIC_USER_SELECT,
    });
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
  // ratings, then the photo files of their jobs.
  async deleteAccount(userId: string, password: string) {
    const user = await this.findWithPassword(userId);
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw wrongPassword();
    }

    const photos = await this.prisma.$transaction(async (tx) => {
      const found = await tx.listingPhoto.findMany({
        where: { listing: { clientId: userId } },
        select: { id: true, listingId: true },
      });
      await tx.user.delete({ where: { id: userId } });
      return found;
    });

    await this.storage.delete(
      photos.flatMap((photo) => {
        const keys = photoKeys(photo.listingId, photo.id);
        return [keys.large, keys.thumbnail];
      }),
    );
  }

  private async findWithPassword(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true, passwordHash: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
