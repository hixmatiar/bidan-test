import { z } from 'zod';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normaliseTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

const dateString = z
  .string()
  .regex(DATE_RE, 'Format tanggal harus YYYY-MM-DD')
  .refine(isCalendarDate, 'Tanggal tidak valid');

const timeString = z
  .string()
  .regex(TIME_RE, 'Format jam harus HH:MM atau HH:MM:SS')
  .transform(normaliseTime);

const sesiFields = z.object({
  tanggal: dateString,
  jam_mulai: timeString,
  jam_selesai: timeString,
  kuota_maks: z.number().int().min(1).max(200),
  durasi_per_pasien: z.number().int().min(5).max(60).default(15),
});

export const createSesiSchema = sesiFields
  .refine((data) => data.jam_selesai > data.jam_mulai, {
    message: 'jam_selesai harus lebih besar dari jam_mulai',
    path: ['jam_selesai'],
  });

export const updateSesiSchema = sesiFields
  .partial()
  .extend({ is_active: z.boolean().optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal satu field harus diisi',
  });

function toBoolean(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export const listSesiSchema = z
  .object({
    tanggal_dari: dateString.optional(),
    tanggal_sampai: dateString.optional(),
    is_active: z.preprocess(toBoolean, z.boolean().optional()),
  })
  .passthrough()
  .refine(
    (data) =>
      !data.tanggal_dari ||
      !data.tanggal_sampai ||
      data.tanggal_dari <= data.tanggal_sampai,
    { message: 'tanggal_dari harus <= tanggal_sampai', path: ['tanggal_dari'] },
  );

export const sesiIdParams = z.object({
  id: z.string().uuid('ID sesi tidak valid'),
});

export type CreateSesiInput = z.infer<typeof createSesiSchema>;
export type UpdateSesiInput = z.infer<typeof updateSesiSchema>;
export interface ListSesiFilters {
  tanggal_dari?: string;
  tanggal_sampai?: string;
  is_active?: boolean;
}
