import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/dto/page.dto.js';
import {
  ListingCategory,
  ListingLocation,
} from '../../generated/prisma/enums.js';

// How an executor was rated so far.
export class RatingSummaryDto {
  /** The mean score, rounded to one decimal. Null without ratings. */
  average!: number | null;

  count!: number;
}

// The client who wrote a rating.
export class RatingClientDto {
  id!: string;

  fullName!: string;
}

export class RatingDto {
  id!: string;

  /** Stars from 1 to 5. */
  score!: number;

  comment!: string | null;

  /** Null when the job was deleted. */
  listingId!: string | null;

  /** The job's title when it was rated. */
  listingTitle!: string;

  client!: RatingClientDto;

  createdAt!: Date;
}

// Newest first.
export class RatingsPageDto extends PageDto {
  items!: RatingDto[];
}

// What anyone can see about a user. The email stays private.
export class UserProfileDto {
  id!: string;

  fullName!: string;

  /** A square WebP image of 256 pixels. Null without a profile photo. */
  avatarUrl!: string | null;

  /** A short introduction written by the user. */
  bio!: string | null;

  /** The kinds of jobs the user does. */
  @ApiProperty({
    enum: ListingCategory,
    enumName: 'ListingCategory',
    isArray: true,
  })
  skills!: ListingCategory[];

  /** Where the user does jobs. */
  @ApiProperty({
    enum: ListingLocation,
    enumName: 'ListingLocation',
    nullable: true,
  })
  location!: ListingLocation | null;

  /** When the user signed up. */
  createdAt!: Date;

  /** Ratings received as an executor. */
  rating!: RatingSummaryDto;
}

// The best rated first. See RatingsService.getExecutors.
export class ExecutorsPageDto extends PageDto {
  items!: UserProfileDto[];
}
