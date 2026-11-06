import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class InvitationOptionsQueryDto {
  /** The user the client wants to invite. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  executorId!: string;
}
