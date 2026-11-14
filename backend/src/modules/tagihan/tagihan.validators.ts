import { z } from 'zod';

const uuid = z.string().uuid('Harus berupa UUID yang valid');

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

export const tagihanIdParamsSchema = z.object({ id: uuid });
export const kunjunganIdParamsSchema = z.object({ id: uuid });

export const listTagihanSchema = z
  .object({
    status: z.enum(['LUNAS', 'BELUM_LUNAS']).optional(),
    tanggal_dari: dateOnly.optional(),
    tanggal_sampai: dateOnly.optional(),
    pasien_id: uuid.optional(),
    q: z.string().trim().max(100).optional(),
  })
  .passthrough()
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

export const catatPembayaranSchema = z.object({
  jumlah: z
    .number()
    .positive('Jumlah pembayaran harus lebih dari nol')
    .max(1_000_000_000_000),
  jalur: z.enum(['MANDIRI', 'BPJS', 'ASURANSI']),
});

export type ListTagihanFilters = z.infer<typeof listTagihanSchema>;
export type CatatPembayaranInput = z.infer<typeof catatPembayaranSchema>;
