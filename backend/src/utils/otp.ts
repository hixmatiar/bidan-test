import { randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcrypt';

const OTP_LENGTH = 6;
const OTP_MAX = 10 ** OTP_LENGTH;
const OTP_BCRYPT_COST = 10;

export function generateOtp(): string {
  return randomInt(0, OTP_MAX).toString().padStart(OTP_LENGTH, '0');
}

export function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, OTP_BCRYPT_COST);
}

export async function compareOtp(otp: string, otpHash: string): Promise<boolean> {
  // Re-hash with the stored salt, then compare bytes in constant time.
  const candidate = await bcrypt.hash(otp, otpHash);
  const candidateBytes = Buffer.from(candidate);
  const storedBytes = Buffer.from(otpHash);

  if (candidateBytes.length !== storedBytes.length) {
    return false;
  }

  return timingSafeEqual(candidateBytes, storedBytes);
}
