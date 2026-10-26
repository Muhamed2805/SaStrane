import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform';

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

  @Transform(trimString)
  @IsString()
  @IsOptional()
  @MaxLength(60)
  proposedPrice?: string;
}
