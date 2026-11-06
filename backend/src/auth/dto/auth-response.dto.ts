import { ApiProperty } from '@nestjs/swagger';
import { ListingCategory, UserRole } from '../../generated/prisma/enums.js';

// The user fields that are safe to send to the client. See public-user.ts.
export class PublicUserDto {
  id!: string;

  email!: string;

  fullName!: string;

  /** Whether the user posts jobs, applies to them, or both. */
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

  /** Whether the user gets emails about applications and messages. */
  emailNotifications!: boolean;

  /** A short introduction for the public profile. */
  bio!: string | null;

  /** The kinds of jobs the user does. */
  @ApiProperty({
    enum: ListingCategory,
    enumName: 'ListingCategory',
    isArray: true,
  })
  skills!: ListingCategory[];

  /** A square WebP image of 256 pixels. Null without a profile photo. */
  avatarUrl!: string | null;

  /** Whether the user can handle reports under /api/admin. */
  isAdmin!: boolean;

  createdAt!: Date;
}

// The refresh token is not part of the body: it goes into an httpOnly
// cookie.
export class AuthSessionDto {
  user!: PublicUserDto;

  /** A short-lived JWT for the Authorization header. */
  accessToken!: string;
}

export class RegistrationDto {
  /** The normalized address the verification code was sent to. */
  email!: string;

  /** Always true: the account can sign in only after the email is verified. */
  verificationRequired!: boolean;

  /** How long the emailed code stays valid. */
  expiresInSeconds!: number;
}

// Returned whether or not the email belongs to an account, so the response
// does not reveal which addresses are registered.
export class SuccessDto {
  success!: boolean;
}
