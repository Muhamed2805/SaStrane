import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/dto/page.dto';
import { ApplicationStatus } from '../../generated/prisma/enums';

export class ApplicationDto {
  id!: string;

  listingId!: string;

  message!: string;

  /** Free text, such as "50 KM". */
  proposedPrice!: string | null;

  @ApiProperty({ enum: ApplicationStatus, enumName: 'ApplicationStatus' })
  status!: ApplicationStatus;

  createdAt!: Date;
}

// The job an application belongs to.
export class ApplicationListingDto {
  title!: string;

  category!: string;

  location!: string;
}

// The user who applied. Only the job's client sees this.
export class ApplicationExecutorDto {
  id!: string;

  fullName!: string;

  email!: string;
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
