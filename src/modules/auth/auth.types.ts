import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export type IAuthUser = {
  id: string;
  isAdmin: boolean;
  role: Role;
};

export type AuthPayload = {
  id: string;
  isAdmin: boolean;
  role: Role;
};

export class LoginInput {
  @ApiProperty({
    example: 'jane@example.com',
    description: 'Email address for the user account.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'strong-password',
    description: 'Plain-text password for the user account.',
  })
  @IsString()
  password: string;
}

export class RegisterInput {
  @ApiProperty({
    example: 'jane@example.com',
    description: 'Email address for the new user account.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Display name for the new user.',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'strong-password',
    description: 'Plain-text password that will be hashed before storage.',
  })
  @IsString()
  password: string;

  @ApiProperty({ example: true, description: 'Admin privileges flag.' })
  @IsBoolean()
  isAdmin: boolean;

  @ApiProperty({
    enum: Role,
    enumName: 'Role',
    example: Role.CLIENT,
    description: 'Role assigned to the user account.',
  })
  @IsEnum(Role)
  role: Role;
}

export class LoginResponse {
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItaWQiLCJpYXQiOjE3MDAwMDAwMDB9.signature',
    description: 'Signed JWT access token for authenticated requests.',
  })
  accessToken: string;
}

export class RegisterResponse {
  @ApiProperty({
    example: 'User registered successfully',
    description: 'Confirmation message returned after creating a user.',
  })
  message: string;
}

export class ForgotPasswordInput {
  @ApiProperty({
    example: 'jane@example.com',
    description: 'Email address tied to the user account.',
  })
  @IsEmail()
  email: string;
}

export class ForgotPasswordResponse {
  @ApiProperty({
    example:
      'If an account exists for this email, a password reset OTP has been sent.',
    description: 'Generic response returned after a reset OTP request.',
  })
  message: string;
}

export class ResetPasswordInput {
  @ApiProperty({
    example: 'jane@example.com',
    description: 'Email address tied to the user account.',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Six-digit OTP sent to the user email address.',
  })
  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;

  @ApiProperty({
    example: 'new-strong-password',
    description: 'Replacement password for the user account.',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ResetPasswordResponse {
  @ApiProperty({
    example: 'Password reset successfully',
    description: 'Confirmation message returned after updating the password.',
  })
  message: string;
}

export class ChangePasswordInput {
  @ApiProperty({
    example: 'current-strong-password',
    description: 'Current password for the authenticated user account.',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    example: 'new-strong-password',
    description: 'Replacement password for the authenticated user account.',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ChangePasswordResponse {
  @ApiProperty({
    example: 'Password changed successfully',
    description:
      'Confirmation message returned after updating the authenticated user password.',
  })
  message: string;
}

export class AuthMeResponse {
  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the authenticated user.',
  })
  id: string;

  @ApiProperty({
    example: 'jane@example.com',
    description: 'Email address of the authenticated user.',
  })
  email: string;

  @ApiProperty({
    example: 'Jane Doe',
    description: 'Display name of the authenticated user.',
  })
  name: string;
}
