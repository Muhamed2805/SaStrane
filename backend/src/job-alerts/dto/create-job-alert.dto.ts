import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import {
  ListingCategory,
  ListingLocation,
} from '../../generated/prisma/enums.js';

// At least one of the two. Leaving one out matches any.
export class CreateJobAlertDto {
  @ApiPropertyOptional({ enum: ListingCategory, enumName: 'ListingCategory' })
  @IsOptional()
  @IsEnum(ListingCategory)
  category?: ListingCategory;

  @ApiPropertyOptional({ enum: ListingLocation, enumName: 'ListingLocation' })
  @IsOptional()
  @IsEnum(ListingLocation)
  location?: ListingLocation;
}
