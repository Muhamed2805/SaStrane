import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform';
import { EMAIL_MAX_LENGTH } from './credential-limits';

export class ResendVerificationDto {
  @Transform(trimString)
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;
}
