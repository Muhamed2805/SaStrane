import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform.js';
import { UserRole } from '../../generated/prisma/enums.js';

// Only the fields that are sent change.
export class UpdateProfileDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  /** Whether the user posts jobs, applies to them, or both. */
  @ApiPropertyOptional({ enum: UserRole, enumName: 'UserRole' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  /** Whether to get emails about applications and messages. */
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;
}
