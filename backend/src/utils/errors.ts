import type { ApiErrorDetail } from '../types/api';

export const ERROR_CATALOG = {
  'ERR-AUTH-01': { http: 401, message: 'Username atau password salah' },
  'ERR-AUTH-02': { http: 401, message: 'Token tidak ada atau tidak valid' },
  'ERR-AUTH-03': { http: 403, message: 'Peran tidak diizinkan' },
  'ERR-AUTH-04': { http: 401, message: 'Token kedaluwarsa' },
  'ERR-AUTH-05': { http: 403, message: 'Akun dinonaktifkan' },
  'ERR-LOCK-01': { http: 423, message: 'Akun terkunci selama 15 menit' },
  'ERR-RSV-01': { http: 409, message: 'Kuota sesi praktik sudah penuh' },
  'ERR-RSV-02': { http: 409, message: 'Jadwal bentrok atau reservasi ganda' },
  'ERR-RSV-03': { http: 404, message: 'Reservasi tidak ditemukan' },
  'ERR-RSV-04': { http: 409, message: 'Transisi status tidak valid' },
  'ERR-RSV-05': { http: 422, message: 'Di luar jam sesi atau tanggal sudah lampau' },
  'ERR-RME-01': { http: 404, message: 'Pasien tidak ditemukan' },
  'ERR-RME-02': { http: 404, message: 'Kunjungan tidak ditemukan' },
  'ERR-RME-03': { http: 409, message: 'Konfirmasi Red-Flag belum dilakukan' },
  'ERR-RME-04': { http: 422, message: 'Item resep tidak valid atau konflik alergi' },
  'ERR-INV-01': { http: 404, message: 'Item inventaris tidak ditemukan' },
  'ERR-INV-02': { http: 409, message: 'Stok tidak cukup' },
  'ERR-INV-03': { http: 422, message: 'Jumlah atau satuan tidak valid' },
  'ERR-FIN-01': { http: 404, message: 'Tagihan tidak ditemukan' },
  'ERR-FIN-02': { http: 409, message: 'Pembayaran melebihi sisa tagihan' },
  'ERR-PRC-01': { http: 422, message: 'Harga atau periode tidak valid' },
  'ERR-CNT-01': { http: 404, message: 'Konten tidak ditemukan' },
  'ERR-NTF-01': { http: 502, message: 'Pengiriman WhatsApp gagal atau retry habis' },
  'ERR-RPT-01': { http: 422, message: 'Parameter laporan tidak valid' },
  'ERR-VAL-01': { http: 422, message: 'Validasi body gagal' },
  'ERR-VAL-02': { http: 422, message: 'Validasi params gagal' },
  'ERR-VAL-03': { http: 422, message: 'Validasi filter atau paginasi gagal' },
  'ERR-VAL-04': { http: 400, message: 'JSON tidak valid' },
  'ERR-SYS-01': { http: 500, message: 'Kesalahan internal server' },
  'ERR-SYS-02': { http: 500, message: 'Kesalahan database' },
  // ponytail: one code, two transports - default 503, rate limiter passes 429 explicitly
  'ERR-SYS-03': { http: 503, message: 'Dependensi eksternal tidak tersedia atau rate limit' },
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly http: number;
  readonly errors?: ApiErrorDetail[];

  constructor(
    code: ErrorCode,
    message?: string,
    errors?: ApiErrorDetail[],
    http?: number,
  ) {
    super(message ?? ERROR_CATALOG[code].message);
    this.name = 'AppError';
    this.code = code;
    this.http = http ?? ERROR_CATALOG[code].http;
    this.errors = errors;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
