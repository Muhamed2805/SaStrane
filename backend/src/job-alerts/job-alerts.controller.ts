import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { CreateJobAlertDto } from './dto/create-job-alert.dto.js';
import { JobAlertDto } from './dto/job-alert-response.dto.js';
import { JobAlertsService } from './job-alerts.service.js';

@ApiTags('job-alerts')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('job-alerts')
export class JobAlertsController {
  constructor(private readonly alerts: JobAlertsService) {}

  /** Lists the user's job alerts, newest first. There are at most 10. */
  @Get()
  getAll(@Req() req: Request): Promise<JobAlertDto[]> {
    const user = req.user as { id: string };
    return this.alerts.getAll(user.id);
  }

  /**
   * Adds a job alert for a kind of job, a location or both.
   *
   * @remarks Each new job that matches is announced under the bell, and by
   * email when the user gets email notifications.
   */
  @ApiErrors({
    400: 'Neither a category nor a location is given (JOB_ALERT_EMPTY), or a field is invalid.',
    409: 'The user has this alert already (JOB_ALERT_EXISTS) or has 10 alerts (TOO_MANY_JOB_ALERTS).',
  })
  @Post()
  create(
    @Body() dto: CreateJobAlertDto,
    @Req() req: Request,
  ): Promise<JobAlertDto> {
    const user = req.user as { id: string };
    return this.alerts.create(user.id, dto);
  }

  /** Deletes one of the user's job alerts. */
  @ApiErrors({ 404: "The alert does not exist or is another user's." })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = req.user as { id: string };
    await this.alerts.remove(id, user.id);
  }
}
