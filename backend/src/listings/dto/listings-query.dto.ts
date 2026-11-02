import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { trimString } from '../../common/transforms/trim-string.transform';
import {
  ListingCategory,
  ListingLocation,
  ListingStatus,
} from '../../generated/prisma/enums';

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
}
