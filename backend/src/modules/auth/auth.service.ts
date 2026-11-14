import type { ConnectionPool } from 'mssql';
import { env } from '@/config/env';
import type { AuthUser, Role } from '@/types/api';
import { AppError } from '@/utils/errors';
import { signToken } from '@/utils/jwt';
import { generateOtp, hashOtp, compareOtp } from '@/utils/otp';
import { comparePassword, hashPassword } from '@/utils/password';
import { sendWa } from '@/utils/wa';
import {
  consumeOtp,
  findLatestValidOtp,
  findUserByUsername,
  incrementFailedAttempts,
  insertNotificationLog,
  registerSuccessfulLogin,
  replaceOtp,
  updatePassword,
} from './auth.repository';
import type { LoginInput, ResetVerifyInput } from './auth.validators';

const RESET_REQUEST_MESSAGE =
  'Jika username terdaftar, kode OTP reset kata sandi telah dikirim melalui WhatsApp';
const INVALID_OTP_MESSAGE = 'Kode OTP tidak valid atau kedaluwarsa';

export interface LoginResult {
  token: string;
  expires_in: number;
  user: {
    user_id: string;
    username: string;
    nama_lengkap: string;
    role: Role;
  };
}

export interface RefreshResult {
  token: string;
  expires_in: number;
}

function invalidOtp(): AppError {
  return new AppError('ERR-VAL-01', INVALID_OTP_MESSAGE, [
    { path: 'kode', message: INVALID_OTP_MESSAGE },
  ]);
}

export async function login(
  db: ConnectionPool,
  input: LoginInput,
): Promise<LoginResult> {
  const user = await findUserByUsername(db, input.username);

  if (!user) throw new AppError('ERR-AUTH-01');
  if (user.is_locked) throw new AppError('ERR-LOCK-01');
  if (!user.is_active) throw new AppError('ERR-AUTH-05');

  const matches = await comparePassword(input.password, user.password_hash);

  if (!matches) {
    const state = await incrementFailedAttempts(
      db,
      user.user_id,
      env.MAX_FAILED_LOGIN,
      env.LOCKOUT_DURATION,
    );
    throw new AppError(state.locked_until ? 'ERR-LOCK-01' : 'ERR-AUTH-01');
  }

  await registerSuccessfulLogin(db, user.user_id);

  const authUser: AuthUser = {
    user_id: user.user_id,
    username: user.username,
    role: user.role as Role,
  };

  return {
    token: signToken(authUser, env.JWT_EXPIRES_IN),
    expires_in: env.JWT_EXPIRES_IN,
    user: { ...authUser, nama_lengkap: user.nama_lengkap },
  };
}

export function logout(): void {
  // Stateless JWT: nothing to revoke, the client discards the token.
}

export function refresh(user: AuthUser): RefreshResult {
  return {
    token: signToken(user, env.JWT_EXPIRES_IN),
    expires_in: env.JWT_EXPIRES_IN,
  };
}

export async function requestReset(
  db: ConnectionPool,
  username: string,
): Promise<string> {
  const user = await findUserByUsername(db, username);

  // Same response for unknown usernames: no account enumeration.
  if (!user) return RESET_REQUEST_MESSAGE;

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  await replaceOtp(db, user.user_id, otpHash, env.OTP_TTL);

  const message = `Kode OTP reset kata sandi Praktik Bidan: ${otp}. Berlaku ${Math.ceil(
    env.OTP_TTL / 60,
  )} menit. Jangan bagikan kode ini.`;

  // Delivery and its log never fail the request: the code is already stored.
  try {
    let status: 'TERKIRIM' | 'GAGAL' = 'GAGAL';
    if (user.no_telepon) {
      try {
        await sendWa(user.no_telepon, message);
        status = 'TERKIRIM';
      } catch {
        status = 'GAGAL';
      }
    }
    await insertNotificationLog(db, 'OTP', user.no_telepon, message, status);
  } catch (error) {
    console.error('Gagal mencatat log notifikasi OTP', error);
  }

  return RESET_REQUEST_MESSAGE;
}

export async function verifyReset(
  db: ConnectionPool,
  input: ResetVerifyInput,
): Promise<string> {
  const user = await findUserByUsername(db, input.username);
  if (!user) throw invalidOtp();

  const otp = await findLatestValidOtp(db, user.user_id);
  if (!otp) throw invalidOtp();

  const matches = await compareOtp(input.kode, otp.otp_hash);
  if (!matches) throw invalidOtp();

  await consumeOtp(db, otp.otp_id);
  await updatePassword(db, user.user_id, await hashPassword(input.password_baru));

  return 'Kata sandi berhasil diperbarui';
}
