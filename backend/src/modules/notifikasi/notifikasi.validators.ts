import { z } from 'zod';

export const NOTIFIKASI_JENIS = [
  'KONFIRMASI',
  'PENGINGAT_H1',
  'PERUBAHAN',
  'INVENTARIS',
  'OTP',
] as const;

export const NOTIFIKASI_STATUS = ['TERKIRIM', 'GAGAL'] as const;

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

export const listNotifikasiSchema = z
  .object({
    jenis: z.enum(NOTIFIKASI_JENIS).optional(),
    status: z.enum(NOTIFIKASI_STATUS).optional(),
    tanggal_dari: dateOnly.optional(),
    tanggal_sampai: dateOnly.optional(),
  })
  .passthrough();

export const notifikasiIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type ListNotifikasiInput = z.infer<typeof listNotifikasiSchema>;
export type NotifikasiIdParams = z.infer<typeof notifikasiIdParamsSchema>;
