import { ApiProperty } from '@nestjs/swagger';
import { PageDto } from '../../common/dto/page.dto.js';
import {
  ListingCategory,
  ListingLocation,
  ListingStatus,
} from '../../generated/prisma/enums.js';
import { ListingPhotoDto } from '../photos/dto/listing-photo-response.dto.js';

// The user who posted the job.
export class ListingClientDto {
  id!: string;

  fullName!: string;

  /** A square WebP image of 256 pixels. Null without a profile photo. */
  avatarUrl!: string | null;
}

// A job as lists show it, without the description.
export class ListingSummaryDto {
  id!: string;

  title!: string;

  @ApiProperty({ enum: ListingCategory, enumName: 'ListingCategory' })
  category!: ListingCategory;

  @ApiProperty({ enum: ListingLocation, enumName: 'ListingLocation' })
  location!: ListingLocation;

  /** Only OPEN jobs take applications. */
  @ApiProperty({ enum: ListingStatus, enumName: 'ListingStatus' })
  status!: ListingStatus;

  /** In whole KM. Null means the price is agreed later. */
  budget!: number | null;

  createdAt!: Date;

  client!: ListingClientDto;

  /** The first photo, or null when the job has none. */
  @ApiProperty({ type: () => ListingPhotoDto, nullable: true })
  coverPhoto!: ListingPhotoDto | null;
}

export class ListingDto extends ListingSummaryDto {
  description!: string | null;

  /** Up to five, the cover first. */
  photos!: ListingPhotoDto[];
}

// Newest first.
export class ListingsPageDto extends PageDto {
  items!: ListingSummaryDto[];
}
