import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartConversationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  listingId!: string;

  /**
   * The user the job's client writes to, who must have applied to the job.
   * Leave it out to write to the job's client.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  executorId?: string;
}
