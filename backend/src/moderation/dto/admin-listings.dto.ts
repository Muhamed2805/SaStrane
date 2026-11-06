import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageDto } from '../../common/dto/page.dto.js';
import { trimString } from '../../common/transforms/trim-string.transform.js';
import {
  ListingCategory,
  ListingLocation,
  ListingStatus,
} from '../../generated/prisma/enums.js';
import { ReportedUserDto } from './report-response.dto.js';

export class AdminListingsQueryDto {
  /** Part of the title. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string;

  /** Leave it out for jobs in every status. */
  @ApiPropertyOptional({ enum: ListingStatus, enumName: 'ListingStatus' })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class AdminListingDto {
  id!: string;

  title!: string;

  @ApiProperty({ enum: ListingStatus, enumName: 'ListingStatus' })
  status!: ListingStatus;

  @ApiProperty({ enum: ListingCategory, enumName: 'ListingCategory' })
  category!: ListingCategory;

  @ApiProperty({ enum: ListingLocation, enumName: 'ListingLocation' })
  location!: ListingLocation;

  createdAt!: Date;

  client!: ReportedUserDto;

  /** The applications to the job. */
  applications!: number;

  /** The open reports about the job. */
  openReports!: number;
}

export class AdminListingsPageDto extends PageDto {
  items!: AdminListingDto[];
}
