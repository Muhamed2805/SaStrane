import { ApplicationStatus } from '../../generated/prisma/enums';
import { IsIn, IsNotEmpty } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsIn([ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED])
  @IsNotEmpty()
  status!: ApplicationStatus;
}
