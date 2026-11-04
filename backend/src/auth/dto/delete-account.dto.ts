import { IsByteLength, IsString, MinLength } from 'class-validator';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MAX_BYTES_MESSAGE,
} from './credential-limits.js';

export class DeleteAccountDto {
  /** The current password, to confirm that the owner deletes the account. */
  @IsString()
  @MinLength(1)
  @IsByteLength(0, PASSWORD_MAX_BYTES, { message: PASSWORD_MAX_BYTES_MESSAGE })
  password!: string;
}
