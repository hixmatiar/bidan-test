import { z } from 'zod';

const phone = z
  .string()
  .trim()
  .min(6, 'Nomor telepon minimal 6 karakter')
  .max(20, 'Nomor telepon maksimal 20 karakter')
  .regex(/^[0-9+\-\s()]+$/, 'Format nomor telepon tidak valid')
  .transform((value) => value.replace(/[\s()-]/g, ''));

const nik = z
  .string()
  .trim()
  .regex(/^\d{16}$/, 'NIK harus 16 digit angka');

export const cekPasienSchema = z
  .object({
    nik: nik.optional(),
    no_telepon: phone.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasNik = value.nik !== undefined;
    const hasPhone = value.no_telepon !== undefined;

    if (hasNik === hasPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nik'],
        message: 'Isi salah satu: nik atau no_telepon',
      });
    }
  });

export const identitasListSchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    is_active: z.boolean().optional(),
  })
  .passthrough();

export type CekPasienInput = z.infer<typeof cekPasienSchema>;
export type IdentitasListFilters = z.infer<typeof identitasListSchema>;
