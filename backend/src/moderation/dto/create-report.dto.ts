import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform.js';
import { ReportReason } from '../../generated/prisma/enums.js';

// Reports a job or a user: give exactly one of listingId and userId.
export class CreateReportDto {
  /** The job to report. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  listingId?: string;

  /** The user to report. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  userId?: string;

  @ApiProperty({ enum: ReportReason, enumName: 'ReportReason' })
  @IsEnum(ReportReason)
  reason!: ReportReason;

  /** What happened, in the reporter's words. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  details?: string;
}
