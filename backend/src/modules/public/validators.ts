import { z } from 'zod';
import type { PaginationMeta } from '@/types/api';
import { AppError } from '@/utils/errors';
import { parsePagination } from '@/utils/pagination';

const KONTEN_TIPE = ['PROFIL', 'LAYANAN', 'KONTAK', 'GALERI', 'TESTIMONI'] as const;
const LAYANAN_KATEGORI = ['KEBIDANAN', 'UMUM'] as const;

type Pagination = Pick<PaginationMeta, 'current_page' | 'per_page'>;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'Tanggal tidak valid');

const kontenSchema = z.object({
  tipe: z.enum(KONTEN_TIPE).optional(),
});

const layananSchema = z.object({
  kategori: z.enum(LAYANAN_KATEGORI).optional(),
});

const sesiSchema = z
  .object({
    tanggal_dari: dateOnly.optional(),
    tanggal_sampai: dateOnly.optional(),
  })
  .refine(
    (value) =>
      !value.tanggal_dari ||
      !value.tanggal_sampai ||
      value.tanggal_dari <= value.tanggal_sampai,
    {
      message: 'tanggal_dari tidak boleh setelah tanggal_sampai',
      path: ['tanggal_dari'],
    },
  );

function parseFilters<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new AppError(
      'ERR-VAL-03',
      undefined,
      parsed.error.issues.map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join('.') : 'root',
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

export type KontenListParams = Pagination & z.infer<typeof kontenSchema>;
export type LayananListParams = Pagination & z.infer<typeof layananSchema>;
export type SesiListParams = Pagination & z.infer<typeof sesiSchema>;

export function validateKontenList(body: unknown): KontenListParams {
  return { ...parsePagination(body), ...parseFilters(kontenSchema, body) };
}

export function validateLayananList(body: unknown): LayananListParams {
  return { ...parsePagination(body), ...parseFilters(layananSchema, body) };
}

export function validateSesiList(body: unknown): SesiListParams {
  return { ...parsePagination(body), ...parseFilters(sesiSchema, body) };
}
