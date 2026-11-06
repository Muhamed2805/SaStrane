import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/dto/page.dto.js';
import {
  ListingStatus,
  ReportReason,
  ReportStatus,
} from '../../generated/prisma/enums.js';

export class ReportUserDto {
  id!: string;

  fullName!: string;
}

export class ReportedUserDto extends ReportUserDto {
  /** Whether an admin suspended the user. */
  suspended!: boolean;
}

// The reported job. It stays on the report after the job is deleted.
export class ReportListingDto {
  /** Null after the job was deleted. */
  id!: string | null;

  title!: string;

  /** Null after the job was deleted. */
  @ApiProperty({
    enum: ListingStatus,
    enumName: 'ListingStatus',
    nullable: true,
  })
  status!: ListingStatus | null;
}

export class ReportDto {
  id!: string;

  @ApiProperty({ enum: ReportReason, enumName: 'ReportReason' })
  reason!: ReportReason;

  details!: string | null;

  @ApiProperty({ enum: ReportStatus, enumName: 'ReportStatus' })
  status!: ReportStatus;

  reporter!: ReportUserDto;

  /** The reported user, or the client of the reported job. */
  reportedUser!: ReportedUserDto;

  /** Null when the report is about a user, not a job. */
  listing!: ReportListingDto | null;

  /** The admin who handled the report. Null while it is open. */
  handledBy!: ReportUserDto | null;

  handledAt!: Date | null;

  createdAt!: Date;
}

export class ReportsPageDto extends PageDto {
  items!: ReportDto[];
}
