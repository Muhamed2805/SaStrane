import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform';

export class ResendVerificationDto {
  @Transform(trimString)
  @IsEmail()
  email!: string;
}
