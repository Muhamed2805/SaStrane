import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ReportStatus } from '../../generated/prisma/enums.js';

const HANDLED = [ReportStatus.RESOLVED, ReportStatus.DISMISSED] as const;
export type HandledStatus = (typeof HANDLED)[number];

export class HandleReportDto {
  /** RESOLVED when the report was right, DISMISSED when it was not. */
  @ApiProperty({ enum: HANDLED })
  @IsIn(HANDLED)
  status!: HandledStatus;
}
