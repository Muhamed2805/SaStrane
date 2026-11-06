import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/transforms/trim-string.transform.js';
import {
  ListingCategory,
  ListingLocation,
  UserRole,
} from '../../generated/prisma/enums.js';

export const BIO_MAX_LENGTH = 500;

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

  /** A short introduction for the public profile. An empty one removes it. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(BIO_MAX_LENGTH)
  bio?: string;

  /** The kinds of jobs the user does. Repeated values count once. */
  @ApiPropertyOptional({
    enum: ListingCategory,
    enumName: 'ListingCategory',
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(Object.keys(ListingCategory).length)
  @IsEnum(ListingCategory, { each: true })
  skills?: ListingCategory[];

  /** Where the user does jobs. Null removes it. */
  @ApiPropertyOptional({
    enum: ListingLocation,
    enumName: 'ListingLocation',
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ListingLocation)
  location?: ListingLocation | null;
}
