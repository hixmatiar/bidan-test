import { z } from 'zod';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Tanggal tidak valid');

export const listAuditLogsSchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    aksi: z.string().trim().min(1).max(30).optional(),
    entitas: z.string().trim().min(1).max(50).optional(),
    user_id: z.string().uuid().optional(),
    tanggal_dari: dateOnly.optional(),
    tanggal_sampai: dateOnly.optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.tanggal_dari && value.tanggal_sampai && value.tanggal_dari > value.tanggal_sampai) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'tanggal_dari tidak boleh melebihi tanggal_sampai',
        path: ['tanggal_dari'],
      });
    }
  });

export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;
