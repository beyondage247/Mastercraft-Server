import { randomInt } from 'crypto';

const OTP_DIGITS = '0123456789';

export function generateOtp(length = 6): string {
  if (length < 4) {
    throw new Error('OTP length must be at least 4 digits.');
  }

  return Array.from({ length }, () => OTP_DIGITS[randomInt(OTP_DIGITS.length)])
    .join('');
}
