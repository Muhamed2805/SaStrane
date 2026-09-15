import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateListingDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  category?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  budget?: string | null;

  @IsString()
  @IsOptional()
  description?: string | null;
}
