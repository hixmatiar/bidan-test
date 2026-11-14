import { z } from 'zod';

const uuid = z.string().uuid('Harus berupa UUID yang valid');

export const pasienIdParamsSchema = z.object({ id: uuid });
export const alergiIdParamsSchema = z.object({ id: uuid });

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
  keterangan: z.string().trim().max(500).nullable().optional(),
});

export type TambahAlergiInput = z.infer<typeof tambahAlergiSchema>;
export type UpdateAlergiInput = z.infer<typeof updateAlergiSchema>;
