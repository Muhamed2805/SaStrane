import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform';
import { EMAIL_MAX_LENGTH } from './credential-limits';

export class LoginDto {
  @Transform(trimString)
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  // No 72-byte limit here: accounts created before that limit existed must
  // still be able to sign in. The cap only bounds the request size.
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
