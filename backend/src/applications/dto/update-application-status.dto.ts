import { ApplicationStatus } from '@prisma/client';
import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsIn([ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED])
  @IsNotEmpty()
  status!: ApplicationStatus;
}
