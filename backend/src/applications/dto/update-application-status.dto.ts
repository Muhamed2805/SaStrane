import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';
import { ApplicationStatus } from '../../generated/prisma/enums';

// An application starts as PENDING. The client can only move it on.
const DECISIONS = [ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED];

export class UpdateApplicationStatusDto {
  @ApiProperty({ enum: DECISIONS })
  @IsIn(DECISIONS)
  @IsNotEmpty()
  status!: (typeof DECISIONS)[number];
}
