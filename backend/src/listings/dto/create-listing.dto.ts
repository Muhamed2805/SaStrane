import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsString()
  @IsOptional()
  budget?: string;

  @IsString()
  @IsOptional()
  description?: string;
}