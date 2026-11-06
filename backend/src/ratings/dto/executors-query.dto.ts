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
import { trimString } from '../../common/transforms/trim-string.transform.js';
import {
  ListingCategory,
  ListingLocation,
} from '../../generated/prisma/enums.js';

export class ExecutorsQueryDto {
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
  limit?: number = 12;

  /** Words from the name or the introduction. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Only executors who do this kind of job. */
  @ApiPropertyOptional({ enum: ListingCategory, enumName: 'ListingCategory' })
  @IsOptional()
  @IsEnum(ListingCategory)
  skill?: ListingCategory;

  @ApiPropertyOptional({ enum: ListingLocation, enumName: 'ListingLocation' })
  @IsOptional()
  @IsEnum(ListingLocation)
  location?: ListingLocation;
}
