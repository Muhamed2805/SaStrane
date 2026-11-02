import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform.js';

export const MAX_MESSAGE_LENGTH = 2000;

export class SendMessageDto {
  /** Spaces at the start and the end are removed. */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  body!: string;
}
