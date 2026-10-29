import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionRevocationReason } from '../generated/prisma/enums';
import * as bcrypt from 'bcrypt';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailService } from './email.service';
import {
  PUBLIC_USER_SELECT,
  toPublicUser,
  type PublicUser,
} from './public-user';
import { SessionsService, type IssuedRefreshToken } from './sessions.service';

export type AccessTokenPayload = {
  sub: string;
  sid: string;
  email: string;
  role: string;
};

export type AuthSession = {
  user: PublicUser;
  accessToken: string;
  // null when the client keeps its current refresh token.
  refreshToken: IssuedRefreshToken | null;
};

const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
const MAX_VERIFICATION_ATTEMPTS = 5;
const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
const MAX_PASSWORD_RESET_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly sessions: SessionsService,
  ) {}

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private createVerificationCode() {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashVerificationCode(email: string, code: string) {
    const secret =
      this.config.get<string>('EMAIL_VERIFICATION_SECRET') ??
      this.config.get<string>('JWT_SECRET');

    if (!secret) {
      throw new ServiceUnavailableException(
        'Email verification is not configured',
      );
    }

    return createHmac('sha256', secret)
      .update(`${this.normalizeEmail(email)}:${code}`)
      .digest('hex');
  }

  private verificationCodeMatches(
    storedHash: string,
    email: string,
    code: string,
  ) {
    const expected = Buffer.from(storedHash, 'hex');
    const received = Buffer.from(this.hashVerificationCode(email, code), 'hex');

    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }

  private hashPasswordResetCode(email: string, code: string) {
    const secret =
      this.config.get<string>('EMAIL_VERIFICATION_SECRET') ??
      this.config.get<string>('JWT_SECRET');

    if (!secret) {
      throw new ServiceUnavailableException('Password reset is not configured');
    }

    return createHmac('sha256', secret)
      .update(`password-reset:${this.normalizeEmail(email)}:${code}`)
      .digest('hex');
  }

  private passwordResetCodeMatches(
    storedHash: string,
    email: string,
    code: string,
  ) {
    const expected = Buffer.from(storedHash, 'hex');
    const received = Buffer.from(
      this.hashPasswordResetCode(email, code),
      'hex',
    );

    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }

  private signAccessToken(user: PublicUser, sessionId: string) {
    const payload: AccessTokenPayload = {
      sub: user.id,
      sid: sessionId,
      email: user.email,
      role: user.role,
    };
    return this.jwt.signAsync(payload);
  }

  private async startSession(
    user: PublicUser,
    userAgent?: string,
  ): Promise<AuthSession> {
    const { sessionId, refreshToken } = await this.sessions.create(
      user.id,
      userAgent,
    );

    return {
      user: toPublicUser(user),
      accessToken: await this.signAccessToken(user, sessionId),
      refreshToken,
    };
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true },
    });

    if (existing) {
      throw new ConflictException({
        code: existing.emailVerifiedAt
          ? 'EMAIL_ALREADY_REGISTERED'
          : 'EMAIL_VERIFICATION_PENDING',
        message: existing.emailVerifiedAt
          ? 'Email je već registrovan.'
          : 'Email čeka potvrdu. Zatraži novi kod.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const code = this.createVerificationCode();
    const now = new Date();

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        emailVerificationCodeHash: this.hashVerificationCode(email, code),
        emailVerificationExpiresAt: new Date(
          now.getTime() + VERIFICATION_CODE_TTL_MS,
        ),
        emailVerificationSentAt: now,
        emailVerificationAttempts: 0,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    try {
      await this.emailService.sendVerificationCode({
        email: user.email,
        fullName: user.fullName,
        code,
      });
    } catch (error) {
      await this.prisma.user.delete({ where: { id: user.id } });
      throw error;
    }

    return {
      email: user.email,
      verificationRequired: true,
      expiresInSeconds: VERIFICATION_CODE_TTL_MS / 1000,
    };
  }

  async login(dto: LoginDto, userAgent?: string): Promise<AuthSession> {
    const email = this.normalizeEmail(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Potvrdi email prije prijave.',
      });
    }

    return this.startSession(user, userAgent);
  }

  async verifyEmail(
    dto: VerifyEmailDto,
    userAgent?: string,
  ): Promise<AuthSession> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (
      !user ||
      user.emailVerifiedAt ||
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpiresAt
    ) {
      throw new BadRequestException('Kod nije ispravan ili je istekao.');
    }

    if (user.emailVerificationExpiresAt <= new Date()) {
      throw new BadRequestException('Kod je istekao. Zatraži novi kod.');
    }

    if (user.emailVerificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      throw new HttpException(
        'Previše pogrešnih pokušaja. Zatraži novi kod.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      !this.verificationCodeMatches(
        user.emailVerificationCodeHash,
        email,
        dto.code,
      )
    ) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Kod nije ispravan ili je istekao.');
    }

    const verifiedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationCodeHash: null,
        emailVerificationExpiresAt: null,
        emailVerificationSentAt: null,
        emailVerificationAttempts: 0,
      },
      select: PUBLIC_USER_SELECT,
    });

    return this.startSession(verifiedUser, userAgent);
  }

  async resendVerification(emailInput: string) {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });

    // The same response for unknown and verified accounts prevents account
    // enumeration through this public endpoint.
    if (!user || user.emailVerifiedAt) {
      return { success: true };
    }

    const now = new Date();
    if (
      user.emailVerificationSentAt &&
      now.getTime() - user.emailVerificationSentAt.getTime() <
        VERIFICATION_RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        'Sačekaj jednu minutu prije slanja novog koda.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.createVerificationCode();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationCodeHash: this.hashVerificationCode(email, code),
        emailVerificationExpiresAt: new Date(
          now.getTime() + VERIFICATION_CODE_TTL_MS,
        ),
        emailVerificationSentAt: now,
        emailVerificationAttempts: 0,
      },
    });

    try {
      await this.emailService.sendVerificationCode({
        email: user.email,
        fullName: user.fullName,
        code,
      });
    } catch (error) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationCodeHash: null,
          emailVerificationExpiresAt: null,
          emailVerificationSentAt: null,
          emailVerificationAttempts: 0,
        },
      });
      throw error;
    }

    return { success: true };
  }

  async forgotPassword(emailInput: string) {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return the same response so this endpoint cannot be used to
    // discover which email addresses have a SaStrane account.
    if (!user?.emailVerifiedAt) {
      return { success: true };
    }

    const now = new Date();
    if (
      user.passwordResetSentAt &&
      now.getTime() - user.passwordResetSentAt.getTime() <
        PASSWORD_RESET_RESEND_COOLDOWN_MS
    ) {
      return { success: true };
    }

    const code = this.createVerificationCode();
    const codeHash = this.hashPasswordResetCode(email, code);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetCodeHash: codeHash,
        passwordResetExpiresAt: new Date(
          now.getTime() + PASSWORD_RESET_CODE_TTL_MS,
        ),
        passwordResetSentAt: now,
        passwordResetAttempts: 0,
      },
    });

    try {
      await this.emailService.sendPasswordResetCode({
        email: user.email,
        fullName: user.fullName,
        code,
      });
    } catch {
      // Keep the public response indistinguishable from an unknown account.
      // Clear only the code created by this request so a concurrent newer
      // request cannot be invalidated.
      await this.prisma.user.updateMany({
        where: { id: user.id, passwordResetCodeHash: codeHash },
        data: {
          passwordResetCodeHash: null,
          passwordResetExpiresAt: null,
          passwordResetSentAt: null,
          passwordResetAttempts: 0,
        },
      });
    }

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (
      !user?.emailVerifiedAt ||
      !user.passwordResetCodeHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt <= new Date()
    ) {
      throw new BadRequestException('Kod nije ispravan ili je istekao.');
    }

    if (user.passwordResetAttempts >= MAX_PASSWORD_RESET_ATTEMPTS) {
      throw new HttpException(
        'Previše pogrešnih pokušaja. Zatraži novi kod.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      !this.passwordResetCodeMatches(
        user.passwordResetCodeHash,
        email,
        dto.code,
      )
    ) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordResetAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Kod nije ispravan ili je istekao.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const passwordChanged = await this.prisma.$transaction(async (tx) => {
      // Matching the code hash makes a concurrent reset with the same code
      // fail instead of applying twice.
      const result = await tx.user.updateMany({
        where: {
          id: user.id,
          passwordResetCodeHash: user.passwordResetCodeHash,
        },
        data: {
          passwordHash,
          passwordResetCodeHash: null,
          passwordResetExpiresAt: null,
          passwordResetSentAt: null,
          passwordResetAttempts: 0,
        },
      });
      if (result.count !== 1) return false;

      // A new password signs out every device, including one an attacker
      // may be using.
      await this.sessions.revokeAllForUser(
        user.id,
        SessionRevocationReason.PASSWORD_RESET,
        tx,
      );
      return true;
    });

    if (!passwordChanged) {
      throw new BadRequestException('Kod nije ispravan ili je istekao.');
    }

    return { success: true };
  }

  async refresh(rawRefreshToken: string): Promise<AuthSession> {
    const grant = await this.sessions.rotate(rawRefreshToken);

    if (!grant) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return {
      user: grant.user,
      accessToken: await this.signAccessToken(grant.user, grant.sessionId),
      refreshToken: grant.refreshToken,
    };
  }

  async logout(rawRefreshToken: string) {
    await this.sessions.revokeByRefreshToken(rawRefreshToken);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
