import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/dto/page.dto.js';
import { NotificationType } from '../../generated/prisma/enums.js';

export class NotificationDto {
  id!: string;

  /**
   * INVITATION: a client invites the user to a job. NEW_APPLICATION:
   * someone applied to the user's job. APPLICATION_ACCEPTED and
   * APPLICATION_REJECTED: the client decided on the user's application.
   * NEW_RATING: a client rated the user.
   */
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType;

  /** Null once the job is deleted. */
  listingId!: string | null;

  /** The job's title when it happened. */
  listingTitle!: string;

  /** The other user's name when it happened. */
  actorName!: string;

  /** Null until the user reads it. */
  readAt!: Date | null;

  createdAt!: Date;
}

// Newest first.
export class NotificationsPageDto extends PageDto {
  items!: NotificationDto[];
}

export class UnreadNotificationsDto {
  count!: number;
}
