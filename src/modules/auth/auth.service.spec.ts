import { hash, verify } from 'argon2';
import { AuthService } from './auth.service';
import * as otpUtils from 'src/utils/otp.utils';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const jwtService = {
    signAsync: jest.fn(),
  };

  const mail = {
    sendPasswordResetOtpMail: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    prisma.user.findUnique.mockReset();
    prisma.user.update.mockReset();
    prisma.user.create.mockReset();
    jwtService.signAsync.mockReset();
    mail.sendPasswordResetOtpMail.mockReset();
    jest.restoreAllMocks();

    service = new AuthService(prisma as any, jwtService as any, mail as any);
  });

  it('stores a hashed otp and emails it for an existing user', async () => {
    jest.spyOn(otpUtils, 'generateOtp').mockReturnValue('123456');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Jane Doe',
      email: 'jane@example.com',
    });
    prisma.user.update.mockResolvedValue({});
    mail.sendPasswordResetOtpMail.mockResolvedValue(undefined);

    const result = await service.forgotPassword({
      email: 'jane@example.com',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordResetOtpHash: expect.any(String),
        passwordResetOtpExpiresAt: expect.any(Date),
      },
    });

    const [firstUpdateCall] = prisma.user.update.mock.calls;
    const { data } = firstUpdateCall[0];
    expect(await verify(data.passwordResetOtpHash, '123456')).toBe(true);
    expect(data.passwordResetOtpExpiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(mail.sendPasswordResetOtpMail).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      otp: '123456',
      expiresInMinutes: 10,
    });
    expect(result).toEqual({
      message:
        'If an account exists for this email, a password reset OTP has been sent.',
    });
  });

  it('returns the same forgot-password response when no user exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword({
      email: 'missing@example.com',
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(mail.sendPasswordResetOtpMail).not.toHaveBeenCalled();
    expect(result).toEqual({
      message:
        'If an account exists for this email, a password reset OTP has been sent.',
    });
  });

  it('resets the password when a valid otp is supplied', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordResetOtpHash: await hash('123456'),
      passwordResetOtpExpiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.resetPassword({
      email: 'jane@example.com',
      otp: '123456',
      newPassword: 'new-password-123',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: expect.any(String),
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
      },
    });

    const [firstUpdateCall] = prisma.user.update.mock.calls;
    const { data } = firstUpdateCall[0];
    expect(await verify(data.password, 'new-password-123')).toBe(true);
    expect(result).toEqual({ message: 'Password reset successfully' });
  });

  it('rejects reset when the otp is expired', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordResetOtpHash: await hash('123456'),
      passwordResetOtpExpiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      service.resetPassword({
        email: 'jane@example.com',
        otp: '123456',
        newPassword: 'new-password-123',
      }),
    ).rejects.toThrow('Invalid or expired OTP');

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('changes the password for an authenticated user when the current password matches', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      password: await hash('current-password-123'),
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.changePassword(
      {
        currentPassword: 'current-password-123',
        newPassword: 'new-password-123',
      },
      {
        id: 'user-1',
        role: 'CLIENT' as any,
        isAdmin: false,
      },
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: expect.any(String),
        passwordResetOtpHash: null,
        passwordResetOtpExpiresAt: null,
      },
    });

    const [firstUpdateCall] = prisma.user.update.mock.calls;
    const { data } = firstUpdateCall[0];
    expect(await verify(data.password, 'new-password-123')).toBe(true);
    expect(result).toEqual({ message: 'Password changed successfully' });
  });

  it('rejects change password when the current password is incorrect', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      password: await hash('current-password-123'),
    });

    await expect(
      service.changePassword(
        {
          currentPassword: 'wrong-password',
          newPassword: 'new-password-123',
        },
        {
          id: 'user-1',
          role: 'CLIENT' as any,
          isAdmin: false,
        },
      ),
    ).rejects.toThrow('Current password is incorrect');

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
