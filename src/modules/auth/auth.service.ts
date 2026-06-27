import { Injectable, Logger } from '@nestjs/common';
import {
  ChangePasswordInput,
  ForgotPasswordInput,
  IAuthUser,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.types';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { bad } from 'src/utils/error.utils';
import { hash, verify } from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { MailService } from 'src/services/mail/mail.service';
import { generateOtp } from 'src/utils/otp.utils';

const PASSWORD_RESET_OTP_EXPIRY_MINUTES = 10;
const PASSWORD_RESET_REQUEST_MESSAGE =
  'If an account exists for this email, a password reset OTP has been sent.';
const INVALID_OR_EXPIRED_OTP_MESSAGE = 'Invalid or expired OTP';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginInput) {
    const { email, password } = dto;
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) bad('Invalid credentials');
    if (!user.isActive) bad('Your account has been deactivated', 403);
    const isMatch = await verify(user.password, password);
    if (!isMatch) bad('Invalid credentials');

    const payload = { id: user.id, role: user.role, isAdmin: user.isAdmin };
    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  async register(dto: RegisterInput) {
    const { email, name, password, role, isAdmin } = dto;
    if (isAdmin && role !== Role.STAFF) {
      bad('Only users with STAFF role can be assigned admin privileges');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) bad('User already exists');

    const hashedPassword = await hash(password);
    await this.prisma.user.create({
      data: { email, name, password: hashedPassword, role, isAdmin },
    });

    return { message: 'User registered successfully' };
  }

  async forgotPassword(dto: ForgotPasswordInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return { message: PASSWORD_RESET_REQUEST_MESSAGE };
    }

    const otp = generateOtp();
    const passwordResetOtpHash = await hash(otp);
    const passwordResetOtpExpiresAt = new Date(
      Date.now() + PASSWORD_RESET_OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetOtpHash,
        passwordResetOtpExpiresAt,
      },
    });

    try {
      await this.mail.sendPasswordResetOtpMail({
        name: user.name,
        email: user.email,
        otp,
        expiresInMinutes: PASSWORD_RESET_OTP_EXPIRY_MINUTES,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password reset OTP email to ${user.email}`,
        error,
      );

      await this.prisma.user
        .update({
          where: { id: user.id },
          data: {
            passwordResetOtpHash: null,
            passwordResetOtpExpiresAt: null,
          },
        })
        .catch((cleanupError: unknown) => {
          this.logger.error(
            `Failed to clear password reset OTP for ${user.email}`,
            cleanupError,
          );
        });

      bad('Unable to send password reset OTP', 500);
    }

    return { message: PASSWORD_RESET_REQUEST_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        passwordResetOtpHash: true,
        passwordResetOtpExpiresAt: true,
      },
    });

    if (!user?.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
      bad(INVALID_OR_EXPIRED_OTP_MESSAGE);
    }

    if (user.passwordResetOtpExpiresAt.getTime() < Date.now()) {
      bad(INVALID_OR_EXPIRED_OTP_MESSAGE);
    }

    const isOtpValid = await verify(user.passwordResetOtpHash, dto.otp);
    if (!isOtpValid) {
      bad(INVALID_OR_EXPIRED_OTP_MESSAGE);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: await hash(dto.newPassword),
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async changePassword(dto: ChangePasswordInput, user: IAuthUser) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        password: true,
      },
    });

    if (!existingUser) {
      bad('User not found', 404);
    }

    const isCurrentPasswordValid = await verify(
      existingUser.password,
      dto.currentPassword,
    );
    if (!isCurrentPasswordValid) {
      bad('Current password is incorrect', 401);
    }

    await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password: await hash(dto.newPassword),
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
      },
    });

    return { message: 'Password changed successfully' };
  }

  async me(user: IAuthUser) {
    return this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
      },
    });
  }
}
