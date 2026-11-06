import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

// Runs after JwtAuthGuard. Reads the flag from the database, so taking it
// away works at once instead of when the access token expires.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = (request.user as { id: string } | undefined)?.id;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { isAdmin: true },
        })
      : null;
    if (!user?.isAdmin) throw new ForbiddenException('Admins only');
    return true;
  }
}
