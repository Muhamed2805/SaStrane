import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/dto/page.dto.js';
import {
  ApplicationStatus,
  ListingCategory,
  ListingLocation,
  ListingStatus,
} from '../../generated/prisma/enums.js';

export class ApplicationDto {
  id!: string;

  listingId!: string;

  message!: string;

  /** In whole KM. Null means the price is agreed later. */
  proposedPrice!: number | null;

  /** A decision is final: only a PENDING application can change. */
  @ApiProperty({ enum: ApplicationStatus, enumName: 'ApplicationStatus' })
  status!: ApplicationStatus;

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
}

// An application as the executor who sent it sees it.
export class MyApplicationDto extends ApplicationDto {
  listing!: ApplicationListingDto;
}

// An application as the job's client sees it.
export class ListingApplicationDto extends ApplicationDto {
  executor!: ApplicationExecutorDto;
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
