import { z } from 'zod';

const uuid = z.string().uuid('Harus berupa UUID yang valid');

const dateTime = z
  .string()
  .trim()
  .min(1, 'Tanggal kunjungan wajib diisi')
  .refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    'Format tanggal kunjungan tidak valid',
  );

export const pasienIdParamsSchema = z.object({ id: uuid });
export const alergiIdParamsSchema = z.object({ id: uuid });
export const kunjunganIdParamsSchema = z.object({ id: uuid });

export const tambahAlergiSchema = z
  .object({
    kategori: z.enum(['ALERGI_OBAT', 'KEHAMILAN_RISTI', 'PENYAKIT_BAWAAN']),
    nama: z.string().trim().min(1).max(150),
    item_id: uuid.optional(),
    keterangan: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kategori === 'ALERGI_OBAT' && !value.item_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['item_id'],
        message: 'item_id wajib diisi untuk kategori ALERGI_OBAT',
      });
    }

    if (value.kategori !== 'ALERGI_OBAT' && value.item_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['item_id'],
        message: 'item_id hanya boleh diisi untuk kategori ALERGI_OBAT',
      });
    }
  });

export const updateAlergiSchema = z.object({
  is_active: z.boolean().optional(),
  keterangan: z.string().trim().max(500).optional(),
});

const resepItemSchema = z.object({
  item_id: uuid,
  jumlah: z
    .number()
    .positive('Jumlah resep harus lebih dari nol')
    .max(1_000_000),
  aturan_pakai: z.string().trim().max(100).optional(),
});

export const buatKunjunganSchema = z.object({
  reservasi_id: uuid.optional(),
  layanan_id: uuid,
  tanggal_kunjungan: dateTime.optional(),
  keluhan: z.string().trim().min(1).max(5000),
  pemeriksaan_fisik: z.string().trim().min(1).max(5000),
  diagnosis: z.string().trim().min(1).max(5000),
  tindakan: z.string().trim().min(1).max(5000),
  catatan_bebas: z.string().trim().max(5000).optional(),
  koreksi_dari_id: uuid.optional(),
  resep: z.array(resepItemSchema).max(50).optional(),
});

export const catatanKunjunganSchema = z.object({
  catatan: z.string().trim().min(1).max(4000),
});

export type TambahAlergiInput = z.infer<typeof tambahAlergiSchema>;
export type UpdateAlergiInput = z.infer<typeof updateAlergiSchema>;
export type BuatKunjunganInput = z.infer<typeof buatKunjunganSchema>;
export type CatatanKunjunganInput = z.infer<typeof catatanKunjunganSchema>;
