import { z } from 'zod';
import type { ApiErrorDetail } from '@/types/api';
import { AppError } from '@/utils/errors';

export const REF_TIPE = ['ITEM', 'LAYANAN'] as const;
export type RefTipe = (typeof REF_TIPE)[number];

const refTipeSchema = z.enum(REF_TIPE);

// YYYY-MM-DD stays a string and is CAST to DATE in SQL, avoiding timezone day shifts.
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine(
    (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
    'Tanggal tidak valid',
  );

export const listHargaSchema = z.object({
  ref_tipe: refTipeSchema.optional(),
  q: z.string().trim().max(100).optional(),
});

// Harga < 0 is deliberately left to dbo.sp_ubah_harga (THROW 50013 -> ERR-PRC-01 -> 422)
// so the API keeps the domain error code instead of a generic body-validation one.
export const ubahHargaSchema = z
  .object({
    harga: z.number().finite(),
    berlaku_dari: dateOnly,
    alasan: z.string().trim().max(255).optional(),
  })
  .strict();

export const ubahHargaParamsSchema = z.object({
  ref_tipe: refTipeSchema,
  ref_id: z.string().uuid(),
});

export const riwayatListParamsSchema = z.object({
  ref_tipe: refTipeSchema,
  ref_id: z.string().uuid(),
});

export type ListHargaFilter = z.infer<typeof listHargaSchema>;
export type UbahHargaInput = z.infer<typeof ubahHargaSchema>;
export type UbahHargaParams = z.infer<typeof ubahHargaParamsSchema>;
export type RiwayatListParams = z.infer<typeof riwayatListParamsSchema>;

function toDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
  }));
}

// List filters/pagination use the report/filter validation code.
export function parseListHarga(body: unknown): ListHargaFilter {
  const parsed = listHargaSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new AppError('ERR-VAL-03', undefined, toDetails(parsed.error));
  }
  return parsed.data;
}

export function parseUbahHargaParams(params: unknown): UbahHargaParams {
  const parsed = ubahHargaParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new AppError('ERR-VAL-02', undefined, toDetails(parsed.error));
  }
  return parsed.data;
}

export function parseRiwayatListParams(params: unknown): RiwayatListParams {
  const parsed = riwayatListParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new AppError('ERR-VAL-02', undefined, toDetails(parsed.error));
  }
  return parsed.data;
}
