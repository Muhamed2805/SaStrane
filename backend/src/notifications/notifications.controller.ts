import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import {
  NotificationsPageDto,
  UnreadNotificationsDto,
} from './dto/notification-response.dto.js';
import { NotificationsQueryDto } from './dto/notifications-query.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Lists the user's notifications, newest first. */
  @ApiErrors({ 400: 'A query parameter is invalid.' })
  @Get()
  getAll(
    @Query() query: NotificationsQueryDto,
    @Req() req: Request,
  ): Promise<NotificationsPageDto> {
    const user = req.user as { id: string };
    return this.notifications.getAll(user.id, query);
  }

  /** Counts the user's unread notifications. */
  @Get('unread-count')
  getUnreadCount(@Req() req: Request): Promise<UnreadNotificationsDto> {
    const user = req.user as { id: string };
    return this.notifications.getUnreadCount(user.id);
  }

  /** Marks all of the user's notifications as read. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('read-all')
  async markAllRead(@Req() req: Request): Promise<void> {
    const user = req.user as { id: string };
    await this.notifications.markAllRead(user.id);
  }

  /** Marks one notification as read. Marking it again changes nothing. */
  @ApiErrors({ 404: "The notification does not exist or is not the user's." })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/read')
  async markRead(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = req.user as { id: string };
    await this.notifications.markRead(id, user.id);
  }
}
