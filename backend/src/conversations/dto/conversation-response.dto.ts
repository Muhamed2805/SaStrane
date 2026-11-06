import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/dto/page.dto.js';
import { ListingStatus } from '../../generated/prisma/enums.js';

// Which side of a conversation the signed-in user is on.
export const CONVERSATION_ROLES = ['CLIENT', 'EXECUTOR'] as const;
export type ConversationRole = (typeof CONVERSATION_ROLES)[number];

export class MessageDto {
  id!: string;

  senderId!: string;

  body!: string;

  createdAt!: Date;
}

// The job a conversation is about.
export class ConversationListingDto {
  id!: string;

  title!: string;

  @ApiProperty({ enum: ListingStatus, enumName: 'ListingStatus' })
  status!: ListingStatus;
}

// The other side of a conversation. Emails stay private here.
export class ConversationUserDto {
  id!: string;

  fullName!: string;

  /** A square WebP image of 256 pixels. Null without a profile photo. */
  avatarUrl!: string | null;
}

export class ConversationDto {
  id!: string;

  listing!: ConversationListingDto;

  /** CLIENT when the signed-in user posted the job, else EXECUTOR. */
  @ApiProperty({ enum: CONVERSATION_ROLES, enumName: 'ConversationRole' })
  role!: ConversationRole;

  otherUser!: ConversationUserDto;

  /** Null until the first message. */
  @ApiProperty({ type: () => MessageDto, nullable: true })
  lastMessage!: MessageDto | null;

  /** The messages from the other side that the user has not read yet. */
  unreadCount!: number;

  createdAt!: Date;
}

// The conversations with at least one message, the latest message first.
export class ConversationsPageDto extends PageDto {
  items!: ConversationDto[];
}

// Newest first.
export class MessagesPageDto {
  items!: MessageDto[];

  /** Pass it as `before` to get older messages. Null on the oldest page. */
  nextCursor!: string | null;
}

export class UnreadCountDto {
  /** Unread messages across all of the user's conversations. */
  count!: number;
}
