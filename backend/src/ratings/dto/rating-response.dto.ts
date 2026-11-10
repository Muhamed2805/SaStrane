import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/dto/page.dto.js';
import { PortfolioPhotoDto } from '../../portfolio/dto/portfolio-photo.dto.js';
import {
  ListingCategory,
  ListingLocation,
} from '../../generated/prisma/enums.js';

// How a user was rated so far, as an executor or as a client.
export class RatingSummaryDto {
  /** The mean score, rounded to one decimal. Null without ratings. */
  average!: number | null;

  count!: number;
}

// How a user works, besides the ratings.
export class UserStatsDto {
  /** Accepted applications on jobs the client closed. */
  completedJobs!: number;

  /**
   * The median minutes the user took to answer a message in the last 90
   * days, from the other side's first unanswered message. Null with fewer
   * than 3 answers.
   */
  responseMinutes!: number | null;
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

// The executor who wrote a rating of a client.
export class RatingExecutorDto {
  id!: string;

  fullName!: string;
}

// An executor's rating of the client they worked for.
export class ClientRatingDto {
  id!: string;

  /** Stars from 1 to 5. */
  score!: number;

  comment!: string | null;

  /** Null when the job was deleted. */
  listingId!: string | null;

  /** The job's title when it was rated. */
  listingTitle!: string;

  executor!: RatingExecutorDto;

  createdAt!: Date;
}

// Newest first.
export class ClientRatingsPageDto extends PageDto {
  items!: ClientRatingDto[];
}

// What anyone can see about a user. The email stays private.
// A user in the list of executors.
export class ExecutorDto {
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

  /** Ratings received as a client, from the executors they hired. */
  clientRating!: RatingSummaryDto;

  stats!: UserStatsDto;
}

// A public profile: the list fields and the gallery of work.
export class UserProfileDto extends ExecutorDto {
  /** Photos of work the user has done, in the user's order. At most 8. */
  portfolio!: PortfolioPhotoDto[];
}

// The best rated first. See RatingsService.getExecutors.
export class ExecutorsPageDto extends PageDto {
  items!: ExecutorDto[];
}
