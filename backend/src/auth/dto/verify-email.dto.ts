import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform';
import { EMAIL_MAX_LENGTH } from './credential-limits';

export class VerifyEmailDto {
  @Transform(trimString)
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @Transform(trimString)
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
