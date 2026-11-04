import { IsByteLength, IsString, MinLength } from 'class-validator';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MAX_BYTES_MESSAGE,
  PASSWORD_MIN_LENGTH,
} from './credential-limits.js';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @IsByteLength(0, PASSWORD_MAX_BYTES, { message: PASSWORD_MAX_BYTES_MESSAGE })
  currentPassword!: string;

  /** At least 8 characters and at most 72 bytes in UTF-8. */
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @IsByteLength(0, PASSWORD_MAX_BYTES, { message: PASSWORD_MAX_BYTES_MESSAGE })
  newPassword!: string;
}
