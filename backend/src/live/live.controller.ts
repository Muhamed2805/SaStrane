import {
  Controller,
  type MessageEvent,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator.js';
import { LiveService } from './live.service.js';

@ApiTags('live')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@UseGuards(JwtAuthGuard)
@Controller('live')
export class LiveController {
  constructor(private readonly live: LiveService) {}

  /**
   * Streams the user's events as server-sent events.
   *
   * @remarks Each event's data is JSON with a `type`: `ready` when the
   * stream opens, `ping` every 15 seconds, `message` with a `conversationId`
   * for a new message that the user got or sent, `read` with a
   * `conversationId` when either side read a conversation, and `notification`
   * for a new notification. Events carry no content: load it from the
   * usual endpoints. The stream ends after 10 minutes; open a new one.
   */
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'The event stream.',
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  @Sse()
  stream(@Req() req: Request): Observable<MessageEvent> {
    const user = req.user as { id: string };
    return this.live.open(user.id).pipe(map((event) => ({ data: event })));
  }
}
