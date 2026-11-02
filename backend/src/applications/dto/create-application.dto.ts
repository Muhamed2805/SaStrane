import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_PRICE_KM } from '../../common/price.js';
import { trimString } from '../../common/transforms/trim-string.transform.js';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  listingId!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  /** In whole KM. Leave it out to agree on the price later. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_KM)
  proposedPrice?: number;
}
