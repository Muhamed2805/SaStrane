import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { MAX_PRICE_KM } from '../../common/price';
import { trimString } from '../../common/transforms/trim-string.transform';
import { IsOmittable } from '../../common/validation/is-omittable';
import { ListingCategory, ListingLocation } from '../../generated/prisma/enums';

// Every field is optional. Only budget and description can be cleared with
// null.
export class UpdateListingDto {
  @Transform(trimString)
  @IsOmittable()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ enum: ListingCategory, enumName: 'ListingCategory' })
  @IsOmittable()
  @IsEnum(ListingCategory)
  category?: ListingCategory;

  @ApiPropertyOptional({ enum: ListingLocation, enumName: 'ListingLocation' })
  @IsOmittable()
  @IsEnum(ListingLocation)
  location?: ListingLocation;

  /** In whole KM. Null means the price is agreed later. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_KM)
  budget?: number | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
