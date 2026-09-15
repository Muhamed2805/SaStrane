import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform';

export class CreateListingDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  category!: string;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  location!: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  budget?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
