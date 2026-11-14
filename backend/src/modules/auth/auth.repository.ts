import type { ConnectionPool } from 'mssql';
import sql from 'mssql';

export interface UserRow {
  user_id: string;
  username: string;
  password_hash: string;
  nama_lengkap: string;
  role: string;
  no_telepon: string | null;
  is_active: boolean;
  failed_attempts: number;
  is_locked: boolean;
}

export interface FailureState {
  failed_attempts: number;
  locked_until: Date | null;
}

export interface OtpRow {
  otp_id: string;
  otp_hash: string;
}

export type NotificationStatus = 'TERKIRIM' | 'GAGAL';

const USER_SELECT = `
SELECT user_id, username, password_hash, nama_lengkap, role, no_telepon, is_active,
       failed_attempts,
       CAST(CASE WHEN locked_until IS NOT NULL AND locked_until > SYSDATETIME()
                 THEN 1 ELSE 0 END AS BIT) AS is_locked
FROM dbo.users
`;

export async function findUserByUsername(
  db: ConnectionPool,
  username: string,
): Promise<UserRow | null> {
  const result = await db
    .request()
    .input('username', sql.NVarChar(50), username)
    .query<UserRow>(`${USER_SELECT} WHERE username = @username`);

  return result.recordset[0] ?? null;
}

// Locks on the Nth consecutive failure; an expired lock restarts the count at 1
// so the failed_attempts 0..5 CHECK can never be exceeded.
const INCREMENT_FAILURES = `
-- OUTPUT ... INTO: dbo.users has an audit trigger, so a bare OUTPUT is rejected.
DECLARE @result TABLE (failed_attempts TINYINT, locked_until DATETIME2(0));

UPDATE dbo.users
SET failed_attempts = CASE
        WHEN failed_attempts >= @max_failed THEN 1
        WHEN locked_until IS NOT NULL AND locked_until <= SYSDATETIME() THEN 1
        ELSE failed_attempts + 1
    END,
    locked_until = CASE
        WHEN failed_attempts < @max_failed
         AND (locked_until IS NULL OR locked_until > SYSDATETIME())
         AND failed_attempts + 1 >= @max_failed
        THEN DATEADD(SECOND, @lockout_seconds, SYSDATETIME())
        ELSE NULL
    END,
    updated_at = SYSDATETIME()
OUTPUT inserted.failed_attempts, inserted.locked_until INTO @result
WHERE user_id = @user_id;

SELECT failed_attempts, locked_until FROM @result;
`;

export async function incrementFailedAttempts(
  db: ConnectionPool,
  userId: string,
  maxFailed: number,
  lockoutSeconds: number,
): Promise<FailureState> {
  const result = await db
    .request()
    .input('user_id', sql.UniqueIdentifier, userId)
    .input('max_failed', sql.TinyInt, maxFailed)
    .input('lockout_seconds', sql.Int, lockoutSeconds)
    .query<FailureState>(INCREMENT_FAILURES);

  return result.recordset[0] ?? { failed_attempts: 0, locked_until: null };
}

export async function registerSuccessfulLogin(
  db: ConnectionPool,
  userId: string,
): Promise<void> {
  await db
    .request()
    .input('user_id', sql.UniqueIdentifier, userId)
    .query(`
UPDATE dbo.users
SET failed_attempts = 0,
    locked_until = NULL,
    last_login_at = SYSDATETIME(),
    updated_at = SYSDATETIME()
WHERE user_id = @user_id;
`);
}

export async function updatePassword(
  db: ConnectionPool,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db
    .request()
    .input('user_id', sql.UniqueIdentifier, userId)
    .input('password_hash', sql.NVarChar(255), passwordHash)
    .query(`
UPDATE dbo.users
SET password_hash = @password_hash,
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = SYSDATETIME()
WHERE user_id = @user_id;
`);
}

export async function replaceOtp(
  db: ConnectionPool,
  userId: string,
  otpHash: string,
  ttlSeconds: number,
): Promise<void> {
  await db
    .request()
    .input('user_id', sql.UniqueIdentifier, userId)
    .query('UPDATE dbo.otp_reset SET is_used = 1 WHERE user_id = @user_id AND is_used = 0;');

  await db
    .request()
    .input('user_id', sql.UniqueIdentifier, userId)
    .input('otp_hash', sql.NVarChar(255), otpHash)
    .input('ttl_seconds', sql.Int, ttlSeconds)
    .query(`
INSERT INTO dbo.otp_reset (user_id, otp_hash, expired_at)
VALUES (@user_id, @otp_hash, DATEADD(SECOND, @ttl_seconds, SYSDATETIME()));
`);
}

export async function findLatestValidOtp(
  db: ConnectionPool,
  userId: string,
): Promise<OtpRow | null> {
  const result = await db
    .request()
    .input('user_id', sql.UniqueIdentifier, userId)
    .query<OtpRow>(`
SELECT TOP (1) otp_id, otp_hash
FROM dbo.otp_reset
WHERE user_id = @user_id
  AND is_used = 0
  AND expired_at > SYSDATETIME()
ORDER BY created_at DESC, otp_id DESC;
`);

  return result.recordset[0] ?? null;
}

export async function consumeOtp(db: ConnectionPool, otpId: string): Promise<void> {
  await db
    .request()
    .input('otp_id', sql.UniqueIdentifier, otpId)
    .query('UPDATE dbo.otp_reset SET is_used = 1 WHERE otp_id = @otp_id;');
}

export async function insertNotificationLog(
  db: ConnectionPool,
  jenis: 'OTP',
  noTelepon: string | null,
  pesan: string,
  status: NotificationStatus,
): Promise<void> {
  await db
    .request()
    .input('jenis', sql.VarChar(20), jenis)
    .input('no_telepon', sql.NVarChar(20), noTelepon)
    .input('pesan', sql.NVarChar(sql.MAX), pesan)
    .input('status', sql.VarChar(20), status)
    .query(`
INSERT INTO dbo.log_notifikasi (jenis, no_telepon, pesan, status, waktu_kirim)
VALUES (@jenis, @no_telepon, @pesan, @status,
        CASE WHEN @status = 'TERKIRIM' THEN SYSDATETIME() ELSE NULL END);
`);
}
