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

const phone = z
  .string()
  .trim()
  .min(6, 'Nomor telepon minimal 6 karakter')
  .max(20, 'Nomor telepon maksimal 20 karakter')
  .regex(/^[0-9+\-\s()]+$/, 'Format nomor telepon tidak valid')
  .transform((value) => value.replace(/[\s()-]/g, ''));

export const pasienBaruSchema = z.object({
  nik: z.string().trim().regex(/^\d{16}$/, 'NIK harus 16 digit angka'),
  nama: z.string().trim().min(1).max(100),
  tgl_lahir: dateOnly,
  alamat: z.string().trim().max(255).optional(),
  no_telepon: phone,
});

const buatReservasiBase = z
  .object({
    sesi_id: uuid,
    layanan_id: uuid,
    pasien_id: uuid.optional(),
    pasien_baru: pasienBaruSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const hasPasienId = value.pasien_id !== undefined;
    const hasPasienBaru = value.pasien_baru !== undefined;

    if (hasPasienId === hasPasienBaru) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pasien_id'],
        message: 'Isi salah satu: pasien_id atau pasien_baru',
      });
    }
  });

export const buatReservasiSchema = buatReservasiBase;

const reservasiStatus = z.enum([
  'MENUNGGU',
  'DIPANGGIL',
  'SELESAI',
  'DIBATALKAN',
]);

export const listReservasiSchema = z
  .object({
    tanggal: dateOnly.optional(),
    tanggal_dari: dateOnly.optional(),
    tanggal_sampai: dateOnly.optional(),
    sesi_id: uuid.optional(),
    status: reservasiStatus.optional(),
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

export const reservasiIdParamsSchema = z.object({ id: uuid });

export const rescheduleReservasiSchema = z.object({
  sesi_id_baru: uuid,
  alasan: z.string().trim().min(1).max(255),
});

export const batalReservasiSchema = z.object({
  alasan: z.string().trim().min(1).max(255),
});

export const updateStatusReservasiSchema = z.object({
  status: z.enum(['MENUNGGU', 'DIPANGGIL', 'SELESAI']),
});

export type BuatReservasiInput = z.infer<typeof buatReservasiSchema>;
export type ListReservasiFilters = z.infer<typeof listReservasiSchema>;
export type RescheduleReservasiInput = z.infer<typeof rescheduleReservasiSchema>;
export type BatalReservasiInput = z.infer<typeof batalReservasiSchema>;
export type UpdateStatusReservasiInput = z.infer<
  typeof updateStatusReservasiSchema
>;
