import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });

    const accessToken = await this.signAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);

    return { user, accessToken, refreshToken };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();

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
