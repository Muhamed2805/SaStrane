import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform';
import { UserRole } from '../../generated/prisma/enums';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_BYTES,
  PASSWORD_MAX_BYTES_MESSAGE,
  PASSWORD_MIN_LENGTH,
} from './credential-limits';

export class RegisterDto {
  @Transform(trimString)
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  /** At least 8 characters and at most 72 bytes in UTF-8. */
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @IsByteLength(0, PASSWORD_MAX_BYTES, { message: PASSWORD_MAX_BYTES_MESSAGE })
  password!: string;

  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  /** Whether the user posts jobs, applies to them, or both. */
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  @IsEnum(UserRole)
  role!: UserRole;
}
