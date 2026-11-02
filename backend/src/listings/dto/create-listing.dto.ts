import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
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
} from '../../generated/prisma/enums.js';

export class CreateListingDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ enum: ListingCategory, enumName: 'ListingCategory' })
  @IsEnum(ListingCategory)
  category!: ListingCategory;

  @ApiProperty({ enum: ListingLocation, enumName: 'ListingLocation' })
  @IsEnum(ListingLocation)
  location!: ListingLocation;

  /** In whole KM. Leave it out when the price is agreed later. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_KM)
  budget?: number;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
