import type { NextFunction, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import { ok } from '@/utils/response';
import * as service from './laporan.service';
import {
  parseExport,
  parseJamTersibuk,
  parsePerbandingan,
  parseRingkasan,
  parseTrenLayanan,
} from './laporan.validators';

type Cell = string | number | null;

interface RingkasanPayload {
  periode: { dari: string; sampai: string };
  jumlah_kunjungan: number;
  pasien_baru: number;
  jumlah_reservasi: number;
  total_pendapatan: number;
  tagihan_belum_lunas: number;
}

interface TrenLayananPayload {
  periode: { dari: string; sampai: string; grup: 'BULANAN' | 'HARIAN' };
  tren: Array<{ periode: string; layanan_id: string; nama_layanan: string; jumlah_kunjungan: number }>;
  top_diagnosis: Array<{ diagnosis: string; jumlah: number }>;
}

interface JamTersibukPayload {
  buckets: Array<{ jam: number; jumlah_reservasi: number }>;
}

interface PerbandinganPayload {
  periode_a: { dari: string; sampai: string };
  periode_b: { dari: string; sampai: string };
  grup: 'LAYANAN';
  per_layanan: Array<{
    layanan_id: string;
    nama_layanan: string;
    V0: number;
    P0: number;
    V1: number;
    P1: number;
    volume_effect: number;
    price_effect: number;
    interaction: number;
    delta: number;
  }>;
  totals: { volume_effect: number; price_effect: number; interaction: number; delta: number };
  meta: { formula: string };
}

type LaporanPayload = RingkasanPayload | TrenLayananPayload | JamTersibukPayload | PerbandinganPayload;

function currentDb(res: Response): ConnectionPool {
  const db = res.locals.db;
  if (!db) throw new AppError('ERR-SYS-02');
  return db;
}

export async function ringkasan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = parseRingkasan(req.body);
    const data = await service.ringkasan(currentDb(res), input);
    ok(res, data, 'Ringkasan laporan berhasil diambil');
  } catch (error) { next(error); }
}

export async function trenLayanan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = parseTrenLayanan(req.body);
    const data = await service.trenLayanan(currentDb(res), input);
    ok(res, data, 'Tren layanan berhasil diambil');
  } catch (error) { next(error); }
}

export async function jamTersibuk(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    parseJamTersibuk(req.body);
    const data = await service.jamTersibuk(currentDb(res));
    ok(res, data, 'Jam tersibuk berhasil diambil');
  } catch (error) { next(error); }
}

export async function perbandingan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = parsePerbandingan(req.body);
    const data = await service.perbandingan(currentDb(res), input);
    ok(res, data, 'Perbandingan berhasil diambil');
  } catch (error) { next(error); }
}

function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function flattenRows(laporan: string, data: LaporanPayload): { sheet: string; columns: string[]; rows: Cell[][] }[] {
  if (laporan === 'ringkasan') {
    const d = data as RingkasanPayload;
    return [{
      sheet: 'Ringkasan',
      columns: ['periode_dari', 'periode_sampai', 'jumlah_kunjungan', 'pasien_baru', 'jumlah_reservasi', 'total_pendapatan', 'tagihan_belum_lunas'],
      rows: [[d.periode.dari, d.periode.sampai, d.jumlah_kunjungan, d.pasien_baru, d.jumlah_reservasi, d.total_pendapatan, d.tagihan_belum_lunas]],
    }];
  }
  if (laporan === 'tren-layanan') {
    const d = data as TrenLayananPayload;
    return [
      {
        sheet: 'Tren',
        columns: ['periode', 'layanan_id', 'nama_layanan', 'jumlah_kunjungan'],
        rows: d.tren.map((r) => [r.periode, r.layanan_id, r.nama_layanan, r.jumlah_kunjungan]),
      },
      {
        sheet: 'Top Diagnosis',
        columns: ['diagnosis', 'jumlah'],
        rows: d.top_diagnosis.map((r) => [r.diagnosis, r.jumlah]),
      },
    ];
  }
  if (laporan === 'jam-tersibuk') {
    const d = data as JamTersibukPayload;
    return [{
      sheet: 'Jam Tersibuk',
      columns: ['jam', 'jumlah_reservasi'],
      rows: d.buckets.map((r) => [r.jam, r.jumlah_reservasi]),
    }];
  }
  const d = data as PerbandinganPayload;
  return [{
    sheet: 'Perbandingan',
    columns: ['layanan_id', 'nama_layanan', 'V0', 'P0', 'V1', 'P1', 'volume_effect', 'price_effect', 'interaction', 'delta'],
    rows: d.per_layanan.map((r) => [r.layanan_id, r.nama_layanan, r.V0, r.P0, r.V1, r.P1, r.volume_effect, r.price_effect, r.interaction, r.delta]),
  }];
}

async function sendExcel(res: Response, slug: string, laporan: string, data: LaporanPayload): Promise<void> {
  const wb = new ExcelJS.Workbook();
  for (const def of flattenRows(laporan, data)) {
    const ws = wb.addWorksheet(def.sheet);
    ws.addRow(def.columns);
    for (const row of def.rows) ws.addRow(row);
  }
  const buffer = await wb.xlsx.writeBuffer();
  const filename = `laporan-${slug}-${todayJakarta()}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}

function sendPdf(res: Response, slug: string, laporan: string, data: LaporanPayload): void {
  const filename = `laporan-${slug}-${todayJakarta()}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(14).text(`Laporan ${laporan}`, { align: 'center' });
  doc.moveDown();
  doc.font('Helvetica').fontSize(9);
  for (const def of flattenRows(laporan, data)) {
    doc.font('Helvetica-Bold').fontSize(11).text(def.sheet);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8).text(def.columns.join(' | '));
    for (const row of def.rows) {
      doc.text(row.map((v) => (v == null ? '' : String(v))).join(' | '), { width: 515 });
    }
    doc.moveDown();
  }
  doc.end();
}

export async function exportLaporan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = parseExport(req.body);
    const result = await service.getExportData(currentDb(res), input);
    const slug = input.laporan;
    if (input.format === 'excel') {
      await sendExcel(res, slug, result.laporan, result.data as LaporanPayload);
    } else {
      sendPdf(res, slug, result.laporan, result.data as LaporanPayload);
    }
  } catch (error) { next(error); }
}
