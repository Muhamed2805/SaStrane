import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageDto } from '../../common/dto/page.dto.js';
import { trimString } from '../../common/transforms/trim-string.transform.js';
import { UserRole } from '../../generated/prisma/enums.js';

export const ADMIN_USER_FILTERS = ['SUSPENDED', 'ADMINS'] as const;
export type AdminUserFilter = (typeof ADMIN_USER_FILTERS)[number];

export class AdminUsersQueryDto {
  /** Part of the name or the email. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string;

  /** Only suspended users or only admins. Leave it out for everyone. */
  @ApiPropertyOptional({
    enum: ADMIN_USER_FILTERS,
    enumName: 'AdminUserFilter',
  })
  @IsOptional()
  @IsIn(ADMIN_USER_FILTERS)
  filter?: AdminUserFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class AdminUserDto {
  id!: string;

  fullName!: string;

  email!: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  avatarUrl!: string | null;

  isAdmin!: boolean;

  /** When an admin suspended the user. Null when the user is not suspended. */
  suspendedAt!: Date | null;

  /** Whether the user confirmed the email address. */
  emailVerified!: boolean;

  createdAt!: Date;

  /** The jobs the user posted. */
  listings!: number;

  /** The applications the user sent. */
  applications!: number;

  /** The open reports about the user and their jobs. */
  openReports!: number;
}

export class AdminUsersPageDto extends PageDto {
  items!: AdminUserDto[];
}
