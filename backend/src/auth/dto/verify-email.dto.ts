import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform.js';
import { EMAIL_MAX_LENGTH } from './credential-limits.js';

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

  // The password of the registration that is being confirmed. It proves
  // that whoever reads the code also chose the account's password.
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
