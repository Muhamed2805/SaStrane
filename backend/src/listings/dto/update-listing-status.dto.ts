import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ListingStatus } from '../../generated/prisma/enums';

export class UpdateListingStatusDto {
  @ApiProperty({ enum: ListingStatus, enumName: 'ListingStatus' })
  @IsEnum(ListingStatus)
  status!: ListingStatus;
}
