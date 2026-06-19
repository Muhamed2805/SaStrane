import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  listingId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  message!: string;

  @IsString()
  @IsOptional()
  proposedPrice?: string;
}
