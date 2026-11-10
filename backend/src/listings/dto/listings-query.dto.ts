import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_PRICE_KM } from '../../common/price.js';
import { trimString } from '../../common/transforms/trim-string.transform.js';
import {
  ListingCategory,
  ListingLocation,
  ListingStatus,
} from '../../generated/prisma/enums.js';

export const LISTING_SORTS = ['NEWEST', 'BUDGET_HIGH', 'BUDGET_LOW'] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

export class ListingsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(64)
  clientId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: ListingCategory, enumName: 'ListingCategory' })
  @IsOptional()
  @IsEnum(ListingCategory)
  category?: ListingCategory;

  @ApiPropertyOptional({ enum: ListingLocation, enumName: 'ListingLocation' })
  @IsOptional()
  @IsEnum(ListingLocation)
  location?: ListingLocation;

  /** Leave it out for jobs in any status. */
  @ApiPropertyOptional({ enum: ListingStatus, enumName: 'ListingStatus' })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  /**
   * Only jobs with a budget of at least this many KM. Jobs with the price
   * agreed later are left out.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_KM)
  minBudget?: number;

  /**
   * Only jobs with a budget of at most this many KM. Jobs with the price
   * agreed later are left out.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_KM)
  maxBudget?: number;

  /**
   * The newest first by default. By budget, the jobs with the price agreed
   * later come last.
   */
  @ApiPropertyOptional({ enum: LISTING_SORTS, enumName: 'ListingSort' })
  @IsOptional()
  @IsIn(LISTING_SORTS)
  sort?: ListingSort;
}
