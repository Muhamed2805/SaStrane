import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform';

export class ForgotPasswordDto {
  @Transform(trimString)
  @IsEmail()
  email!: string;
}
