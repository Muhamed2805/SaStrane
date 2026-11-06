import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator.js';
import { AdminGuard } from './admin.guard.js';
import { HandleReportDto } from './dto/handle-report.dto.js';
import { ReportDto, ReportsPageDto } from './dto/report-response.dto.js';
import { ReportsQueryDto } from './dto/reports-query.dto.js';
import { ModerationService } from './moderation.service.js';

@ApiTags('admin')
@ApiBearerAuth()
@ApiErrors({
  ...COMMON_ERRORS,
  ...SIGNED_IN_ERRORS,
  403: 'The user is not an admin.',
})
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly moderation: ModerationService) {}

  /** Lists the reports, newest first. */
  @ApiErrors({ 400: 'A query parameter is invalid.' })
  @Get('reports')
  getReports(@Query() query: ReportsQueryDto): Promise<ReportsPageDto> {
    return this.moderation.getReports(query);
  }

  /** Marks an open report as resolved or dismissed. */
  @ApiErrors({
    400: 'The status is not RESOLVED or DISMISSED.',
    404: 'The report does not exist.',
    409: 'The report was already handled (REPORT_ALREADY_HANDLED).',
  })
  @Patch('reports/:id')
  handle(
    @Param('id') id: string,
    @Body() dto: HandleReportDto,
    @Req() req: Request,
  ): Promise<ReportDto> {
    const admin = req.user as { id: string };
    return this.moderation.handle(id, dto.status, admin.id);
  }

  /**
   * Deletes any job with its applications and photos.
   *
   * @remarks The open reports about the job become RESOLVED.
   */
  @ApiErrors({ 404: 'The job does not exist.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('listings/:id')
  async deleteListing(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const admin = req.user as { id: string };
    await this.moderation.deleteListing(id, admin.id);
  }

  /**
   * Suspends a user.
   *
   * @remarks The user's sessions end, the open jobs close and the open
   * reports about the user become RESOLVED. Signing in returns 403 with
   * the code ACCOUNT_SUSPENDED until the suspension is lifted.
   */
  @ApiErrors({
    403: 'The user is an admin, or the admin is suspending themselves.',
    404: 'The user does not exist.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('users/:id/suspend')
  async suspend(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const admin = req.user as { id: string };
    await this.moderation.suspend(id, admin.id);
  }

  /** Lifts a suspension. The user's jobs stay closed. */
  @ApiErrors({ 404: 'The user does not exist.' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('users/:id/unsuspend')
  async unsuspend(@Param('id') id: string): Promise<void> {
    await this.moderation.unsuspend(id);
  }
}
