import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform';

export class VerifyEmailDto {
  @Transform(trimString)
  @IsEmail()
  email!: string;

  @Transform(trimString)
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
