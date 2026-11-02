import {
  Body,
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
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  ApiErrors,
  COMMON_ERRORS,
  SIGNED_IN_ERRORS,
} from '../openapi/api-errors.decorator.js';
import { ConversationsService } from './conversations.service.js';
import {
  ConversationDto,
  ConversationsPageDto,
  MessageDto,
  MessagesPageDto,
  UnreadCountDto,
} from './dto/conversation-response.dto.js';
import {
  ConversationsQueryDto,
  MessagesQueryDto,
} from './dto/conversations-query.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { StartConversationDto } from './dto/start-conversation.dto.js';

const CONVERSATION_ERRORS = {
  403: 'The user is not in this conversation.',
  404: 'The conversation does not exist.',
};

// The site checks for new messages every few seconds while a conversation
// is open, so reading has a higher limit than the default.
@ApiTags('conversations')
@ApiBearerAuth()
@ApiErrors({ ...COMMON_ERRORS, ...SIGNED_IN_ERRORS })
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  /**
   * Returns the conversation about a job, and creates it the first time.
   *
   * @remarks Without `executorId`, the user writes to the job's client. The
   * client gives `executorId` to write to a user who applied. A new
   * conversation needs an OPEN job, unless the client starts it.
   */
  @ApiErrors({
    400: 'A field is missing or invalid.',
    403: "The user would write to themselves, chose another user without being the job's client, or chose a user who has not applied.",
    404: 'The job does not exist.',
    409: 'The job is closed (LISTING_CLOSED).',
  })
  @HttpCode(HttpStatus.OK)
  @Post()
  start(
    @Body() dto: StartConversationDto,
    @Req() req: Request,
  ): Promise<ConversationDto> {
    const user = req.user as { id: string };
    return this.conversations.start(dto, user.id);
  }

  /** Lists the user's conversations, the latest message first. */
  @ApiErrors({ 400: 'A query parameter is invalid.' })
  @Get()
  getAll(
    @Query() query: ConversationsQueryDto,
    @Req() req: Request,
  ): Promise<ConversationsPageDto> {
    const user = req.user as { id: string };
    return this.conversations.getAll(user.id, query);
  }

  /** Counts the unread messages across all of the user's conversations. */
  @Get('unread-count')
  getUnreadCount(@Req() req: Request): Promise<UnreadCountDto> {
    const user = req.user as { id: string };
    return this.conversations.getUnreadCount(user.id);
  }

  /** Returns one of the user's conversations. */
  @ApiErrors(CONVERSATION_ERRORS)
  @Get(':id')
  getById(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<ConversationDto> {
    const user = req.user as { id: string };
    return this.conversations.getById(id, user.id);
  }

  /** Lists the messages of a conversation, newest first. */
  @ApiErrors({
    ...CONVERSATION_ERRORS,
    400: 'A query parameter is invalid.',
    404: 'The conversation does not exist, or `before` is not one of its messages.',
  })
  @Get(':id/messages')
  getMessages(
    @Param('id') id: string,
    @Query() query: MessagesQueryDto,
    @Req() req: Request,
  ): Promise<MessagesPageDto> {
    const user = req.user as { id: string };
    return this.conversations.getMessages(id, user.id, query);
  }

  /** Sends a message. The job may be closed. */
  @ApiErrors({
    ...CONVERSATION_ERRORS,
    400: 'The message is empty or too long.',
  })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/messages')
  send(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ): Promise<MessageDto> {
    const user = req.user as { id: string };
    return this.conversations.send(id, dto, user.id);
  }

  /** Marks the conversation as read by the user. */
  @ApiErrors(CONVERSATION_ERRORS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/read')
  async markRead(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = req.user as { id: string };
    await this.conversations.markRead(id, user.id);
  }
}
