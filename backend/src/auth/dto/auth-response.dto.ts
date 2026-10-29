import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../generated/prisma/enums';

// The user fields that are safe to send to the client. See public-user.ts.
export class PublicUserDto {
  id!: string;

  email!: string;

  fullName!: string;

  /** Whether the user posts jobs, applies to them, or both. */
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role!: UserRole;

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
