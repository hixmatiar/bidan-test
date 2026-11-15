import { z } from 'zod';
import type { ApiErrorDetail } from '@/types/api';
import { AppError } from '@/utils/errors';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Tanggal tidak valid');

const rangeSchema = z.object({ dari: dateOnly, sampai: dateOnly });

function dayNumber(value: string): number {
  return Math.floor(Date.parse(`${value}T00:00:00Z`) / 86_400_000);
}

function todayJakartaDay(): number {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return dayNumber(today);
}

function toDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
  }));
}

function parse<T>(schema: z.ZodType<T>, body: unknown, code: 'ERR-RPT-01' | 'ERR-VAL-01' = 'ERR-RPT-01'): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new AppError(code, undefined, toDetails(parsed.error));
  }
  return parsed.data;
}

function assertRange(dari: string, sampai: string): void {
  if (dayNumber(dari) > dayNumber(sampai)) {
    throw new AppError('ERR-RPT-01', 'Rentang tanggal tidak valid: dari tidak boleh setelah sampai');
  }
}

export function parseRingkasan(body: unknown): { dari: string; sampai: string } {
  const data = parse(rangeSchema, body);
  assertRange(data.dari, data.sampai);
  if (dayNumber(data.dari) > todayJakartaDay()) {
    throw new AppError('ERR-RPT-01', 'Tanggal dari tidak boleh di masa depan');
  }
  return data;
}

export const trenLayananSchema = rangeSchema.extend({
  grup: z.enum(['BULANAN', 'HARIAN']),
});
export type TrenLayananInput = z.infer<typeof trenLayananSchema>;

export function parseTrenLayanan(body: unknown): TrenLayananInput {
  const data = parse(trenLayananSchema, body);
  assertRange(data.dari, data.sampai);
  if (dayNumber(data.dari) > todayJakartaDay()) {
    throw new AppError('ERR-RPT-01', 'Tanggal dari tidak boleh di masa depan');
  }
  return data;
}

export function parseJamTersibuk(_body: unknown): Record<string, never> {
  return {};
}

const periodeSchema = z.object({ dari: dateOnly, sampai: dateOnly });
export const perbandinganSchema = z.object({
  periode_a: periodeSchema,
  periode_b: periodeSchema,
  grup: z.enum(['LAYANAN']).optional(),
});
export interface PerbandinganInput {
  periode_a: { dari: string; sampai: string };
  periode_b: { dari: string; sampai: string };
  grup: 'LAYANAN';
}

export function parsePerbandingan(body: unknown): PerbandinganInput {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (!raw.periode_a || !raw.periode_b) {
    throw new AppError('ERR-RPT-01', 'Parameter laporan tidak valid', [
      ...(!raw.periode_a ? [{ path: 'periode_a', message: 'periode_a wajib diisi' }] : []),
      ...(!raw.periode_b ? [{ path: 'periode_b', message: 'periode_b wajib diisi' }] : []),
    ]);
  }
  const data = parse(perbandinganSchema, body, 'ERR-VAL-01');
  assertRange(data.periode_a.dari, data.periode_a.sampai);
  assertRange(data.periode_b.dari, data.periode_b.sampai);
  const aStart = dayNumber(data.periode_a.dari);
  const aEnd = dayNumber(data.periode_a.sampai);
  const bStart = dayNumber(data.periode_b.dari);
  const bEnd = dayNumber(data.periode_b.sampai);
  if (!(aEnd < bStart || bEnd < aStart)) {
    throw new AppError('ERR-RPT-01', 'Periode tidak boleh tumpang tindih');
  }
  return { ...data, grup: 'LAYANAN' };
}

export const exportSchema = z.object({
  format: z.enum(['pdf', 'excel']),
  laporan: z.enum(['ringkasan', 'tren-layanan', 'jam-tersibuk', 'perbandingan']),
  dari: dateOnly.optional(),
  sampai: dateOnly.optional(),
  grup: z.enum(['BULANAN', 'HARIAN']).optional(),
  periode_a: periodeSchema.optional(),
  periode_b: periodeSchema.optional(),
});
export type ExportInput = z.infer<typeof exportSchema>;

export function parseExport(body: unknown): ExportInput {
  const raw = body ?? {};
  if (typeof raw === 'object' && raw !== null && 'format' in raw) {
    const fmt = (raw as Record<string, unknown>).format;
    if (fmt !== 'pdf' && fmt !== 'excel') {
      throw new AppError('ERR-RPT-01', 'Format export tidak valid');
    }
  }
  const data = parse(exportSchema, body);
  if (data.laporan === 'perbandingan') {
    if (!data.periode_a || !data.periode_b) {
      throw new AppError('ERR-RPT-01', 'periode_a dan periode_b wajib untuk perbandingan');
    }
  } else {
    if (!data.dari || !data.sampai) {
      throw new AppError('ERR-RPT-01', 'dari dan sampai wajib diisi');
    }
    assertRange(data.dari, data.sampai);
  }
  return data;
}
