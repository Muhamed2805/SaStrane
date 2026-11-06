import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { ModerationService } from './moderation.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly moderation: ModerationService) {}

  /**
   * Reports a job or a user to the admins.
   *
   * @remarks Give exactly one of `listingId` and `userId`. Allows 10
   * requests per minute.
   */
  @ApiErrors({
    400: 'Both or neither of listingId and userId are given, or a field is invalid.',
    403: "The job is the user's own, or the user is reporting themselves.",
    404: 'The job or the user does not exist.',
    409: 'The user already has an open report about it (ALREADY_REPORTED).',
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post()
  async create(
    @Body() dto: CreateReportDto,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as { id: string };
    await this.moderation.report(dto, user.id);
  }
}
