import { z } from 'zod';
import type { ApiErrorDetail } from '@/types/api';
import { AppError } from '@/utils/errors';

export const KATEGORI = ['OBAT', 'PRODUK_KESEHATAN'] as const;
export const STATUS_STOK = ['HABIS', 'KEDALUWARSA', 'MENIPIS', 'AMAN'] as const;

// YYYY-MM-DD stays a string and is CAST to DATE in SQL, avoiding timezone day shifts.
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine(
    (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
    'Tanggal tidak valid',
  );

const nonNegative = z.number().min(0, 'Nilai tidak boleh negatif');

export const listInventarisSchema = z.object({
  kategori: z.enum(KATEGORI).optional(),
  status_stok: z.enum(STATUS_STOK).optional(),
  q: z.string().trim().max(100).optional(),
});

export const createInventarisSchema = z.object({
  nama: z.string().trim().min(1).max(100),
  kategori: z.enum(KATEGORI),
  satuan: z.string().trim().min(1).max(20),
  stok: nonNegative,
  stok_minimum: nonNegative.optional(),
  tgl_kedaluwarsa: dateOnly.nullable().optional(),
  harga: nonNegative.optional(),
});

// ponytail: stok is deliberately absent and strict() rejects it, so stok patches fail 422.
export const updateInventarisSchema = z
  .object({
    nama: z.string().trim().min(1).max(100).optional(),
    satuan: z.string().trim().min(1).max(20).optional(),
    stok_minimum: nonNegative.optional(),
    tgl_kedaluwarsa: dateOnly.nullable().optional(),
    is_active: z.boolean().optional(),
    harga: nonNegative.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Minimal satu field harus diisi',
  });

export const idParamSchema = z.object({ id: z.string().uuid() });

export type ListInventarisFilter = z.infer<typeof listInventarisSchema>;
export type CreateInventarisInput = z.infer<typeof createInventarisSchema>;
export type UpdateInventarisInput = z.infer<typeof updateInventarisSchema>;

function toDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
  }));
}

// List filters/pagination use the report/filter validation code.
export function parseListInventaris(body: unknown): ListInventarisFilter {
  const parsed = listInventarisSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new AppError('ERR-VAL-03', undefined, toDetails(parsed.error));
  }
  return parsed.data;
}
