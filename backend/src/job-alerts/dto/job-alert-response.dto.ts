import { ApiProperty } from '@nestjs/swagger';
import {
  ListingCategory,
  ListingLocation,
} from '../../generated/prisma/enums.js';

// New open jobs that match are announced under the bell and by email.
export class JobAlertDto {
  id!: string;

  /** Null matches any kind of job. */
  @ApiProperty({
    enum: ListingCategory,
    enumName: 'ListingCategory',
    nullable: true,
  })
  category!: ListingCategory | null;

  /** Null matches any location. */
  @ApiProperty({
    enum: ListingLocation,
    enumName: 'ListingLocation',
    nullable: true,
  })
  location!: ListingLocation | null;

  createdAt!: Date;
}
