import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/dto/page.dto.js';
import { RatingSummaryDto } from '../../ratings/dto/rating-response.dto.js';
import {
  ApplicationStatus,
  ListingCategory,
  ListingLocation,
  ListingStatus,
} from '../../generated/prisma/enums.js';

// The client's rating of the executor for this job.
export class ApplicationRatingDto {
  /** Stars from 1 to 5. */
  score!: number;

  comment!: string | null;

  createdAt!: Date;
}

export class ApplicationDto {
  id!: string;

  listingId!: string;

  message!: string;

  /** In whole KM. Null means the price is agreed later. */
  proposedPrice!: number | null;

  /** A decision is final: only a PENDING application can change. */
  @ApiProperty({ enum: ApplicationStatus, enumName: 'ApplicationStatus' })
  status!: ApplicationStatus;

  /** Null until the client rates the executor. */
  @ApiProperty({ type: () => ApplicationRatingDto, nullable: true })
  rating!: ApplicationRatingDto | null;

  createdAt!: Date;
}

// The job an application belongs to.
export class ApplicationListingDto {
  title!: string;

  @ApiProperty({ enum: ListingCategory, enumName: 'ListingCategory' })
  category!: ListingCategory;

  @ApiProperty({ enum: ListingLocation, enumName: 'ListingLocation' })
  location!: ListingLocation;

  @ApiProperty({ enum: ListingStatus, enumName: 'ListingStatus' })
  status!: ListingStatus;
}

// The user who applied. Only the job's client sees this.
export class ApplicationExecutorDto {
  id!: string;

  fullName!: string;

  /** Null until the client accepts the application. */
  email!: string | null;

  /** Ratings the executor received for all jobs. */
  rating!: RatingSummaryDto;
}

// An application as the executor who sent it sees it.
export class MyApplicationDto extends ApplicationDto {
  listing!: ApplicationListingDto;
}

// An application as the job's client sees it.
export class ListingApplicationDto extends ApplicationDto {
  executor!: ApplicationExecutorDto;

  /** True when the application is accepted, the job is closed and the
   * executor is not rated yet. */
  canRate!: boolean;
}

// An application in the client's inbox, across all of their jobs.
export class ReceivedApplicationDto extends ListingApplicationDto {
  listing!: ApplicationListingDto;
}

// Newest first.
export class MyApplicationsPageDto extends PageDto {
  items!: MyApplicationDto[];
}

// Newest first.
export class ReceivedApplicationsPageDto extends PageDto {
  items!: ReceivedApplicationDto[];
}
