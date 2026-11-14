import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import * as repository from './keuangan.repository';
import type { RekapPendapatanRow } from './keuangan.repository';
import type { RekapPendapatanInput } from './keuangan.validators';

const MAX_SPAN_DAYS = 366;

function dayNumber(value: string): number {
  return Math.floor(Date.parse(`${value}T00:00:00Z`) / 86_400_000);
}

export interface RekapPendapatanResult {
  periode: {
    dari: string;
    sampai: string;
    grup: 'HARIAN' | 'BULANAN';
  };
  rows: RekapPendapatanRow[];
  total: {
    jumlah_transaksi: number;
    total_pendapatan: number;
  };
}

export async function rekapPendapatan(
  db: ConnectionPool,
  input: RekapPendapatanInput,
): Promise<RekapPendapatanResult> {
  const span = dayNumber(input.sampai) - dayNumber(input.dari) + 1;

  if (span < 1) {
    throw new AppError(
      'ERR-RPT-01',
      'Rentang tanggal tidak valid: dari tidak boleh setelah sampai',
    );
  }

  if (span > MAX_SPAN_DAYS) {
    throw new AppError(
      'ERR-RPT-01',
      `Rentang tanggal maksimal ${MAX_SPAN_DAYS} hari`,
    );
  }

  const rows = await repository.rekapPendapatan(db, {
    dari: input.dari,
    sampai: input.sampai,
    grup: input.grup,
  });

  const totalTransaksi = rows.reduce(
    (sum, row) => sum + Number(row.jumlah_transaksi),
    0,
  );
  const totalPendapatan = rows.reduce(
    (sum, row) => sum + Number(row.total_pendapatan),
    0,
  );

  return {
    periode: {
      dari: input.dari,
      sampai: input.sampai,
      grup: input.grup,
    },
    rows,
    total: {
      jumlah_transaksi: totalTransaksi,
      total_pendapatan: Math.round(totalPendapatan * 100) / 100,
    },
  };
}
