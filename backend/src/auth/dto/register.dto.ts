import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export enum UserRole {
  CLIENT = 'CLIENT',
  EXECUTOR = 'EXECUTOR',
  BOTH = 'BOTH',
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}