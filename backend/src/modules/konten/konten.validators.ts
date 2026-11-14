import { z } from 'zod';

export const KONTEN_TIPE = ['PROFIL', 'LAYANAN', 'KONTAK', 'GALERI', 'TESTIMONI'] as const;

const base = z.object({
  tipe: z.enum(KONTEN_TIPE),
  judul: z.string().trim().min(1).max(150),
  isi: z.string().trim().max(4000).nullable().optional(),
  media_url: z.string().trim().max(500).nullable().optional(),
  urutan: z.number().int().min(0).optional(),
  is_published: z.boolean().optional(),
});

export const createKontenSchema = base.strict();

export const updateKontenSchema = base
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Minimal satu field harus diisi',
  });

export const listKontenSchema = z
  .object({
    tipe: z.enum(KONTEN_TIPE).optional(),
    is_published: z.boolean().optional(),
  })
  .passthrough();

export const kontenIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateKontenInput = z.infer<typeof createKontenSchema>;
export type UpdateKontenInput = z.infer<typeof updateKontenSchema>;
export type ListKontenFilter = z.infer<typeof listKontenSchema>;
export type KontenIdParams = z.infer<typeof kontenIdParamsSchema>;
