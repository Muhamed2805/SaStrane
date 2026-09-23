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
import * as bcrypt from 'bcrypt';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailService } from './email.service';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute
const MAX_VERIFICATION_ATTEMPTS = 5;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
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

  private signAccessToken(user: { id: string; email: string; role: string }) {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private async issueRefreshToken(userId: string) {
    const rawToken = randomBytes(32).toString('hex');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: hashToken(rawToken),
        refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return rawToken;
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

  async login(dto: LoginDto) {
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

    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
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
    });
    const accessToken = await this.signAccessToken(verifiedUser);
    const refreshToken = await this.issueRefreshToken(verifiedUser.id);

    return {
      user: {
        id: verifiedUser.id,
        email: verifiedUser.email,
        fullName: verifiedUser.fullName,
        role: verifiedUser.role,
        createdAt: verifiedUser.createdAt,
      },
      accessToken,
      refreshToken,
    };
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

  async refresh(rawRefreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { refreshTokenHash: hashToken(rawRefreshToken) },
    });

    if (
      !user ||
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null, refreshTokenExpiresAt: null },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
