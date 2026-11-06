import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateInvitationDto {
  /** One of the client's open jobs. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  listingId!: string;

  /** The user who does jobs and gets the invitation. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  executorId!: string;
}
