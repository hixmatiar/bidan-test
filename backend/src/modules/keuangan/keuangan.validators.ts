import { z } from 'zod';

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

export const rekapPendapatanSchema = z.object({
  dari: dateOnly,
  sampai: dateOnly,
  grup: z.enum(['HARIAN', 'BULANAN']).default('HARIAN'),
});

export type RekapPendapatanInput = z.infer<typeof rekapPendapatanSchema>;
