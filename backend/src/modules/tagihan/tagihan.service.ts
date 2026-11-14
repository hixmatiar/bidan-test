import type { ConnectionPool } from 'mssql';
import { AppError } from '@/utils/errors';
import * as repository from './tagihan.repository';
import type {
  PembayaranResult,
  PembayaranRow,
  TagihanDetailRow,
  TagihanListRow,
  TagihanStatus,
} from './tagihan.repository';
import type {
  CatatPembayaranInput,
  ListTagihanFilters,
} from './tagihan.validators';

export interface TagihanDetail {
  tagihan_id: string;
  kunjungan_id: string;
  tanggal_kunjungan: Date;
  pasien: {
    pasien_id: string;
    nama: string;
  };
  rincian: Array<{
    rincian_id: string;
    tipe: 'ITEM' | 'LAYANAN';
    nama: string;
    qty: number;
    harga_satuan: number;
    subtotal: number;
  }>;
  total_tagihan: number;
  total_dibayar: number;
  sisa_tagihan: number;
  status: TagihanStatus;
  pembayaran: PembayaranRow[];
}

export async function detailTagihan(
  db: ConnectionPool,
  kunjunganId: string,
): Promise<TagihanDetail> {
  const rows = await repository.findDetailByKunjungan(db, kunjunganId);

  if (rows.length === 0) {
    throw new AppError('ERR-FIN-01');
  }

  const first = rows[0];
  const pembayaran = await repository.listPembayaran(db, first.tagihan_id);

  return {
    tagihan_id: first.tagihan_id,
    kunjungan_id: first.kunjungan_id,
    tanggal_kunjungan: first.tanggal_kunjungan,
    pasien: {
      pasien_id: first.pasien_id,
      nama: first.nama_pasien,
    },
    rincian: rows
      .filter(
        (
          row,
        ): row is TagihanDetailRow & {
          rincian_id: string;
          tipe: 'ITEM' | 'LAYANAN';
          nama_baris: string;
          qty: number;
          harga_satuan: number;
          subtotal: number;
        } => row.rincian_id !== null,
      )
      .map((row) => ({
        rincian_id: row.rincian_id,
        tipe: row.tipe ?? 'LAYANAN',
        nama: row.nama_baris,
        qty: row.qty,
        harga_satuan: row.harga_satuan,
        subtotal: row.subtotal,
      })),
    total_tagihan: first.total_tagihan,
    total_dibayar: first.total_dibayar,
    sisa_tagihan: first.sisa_tagihan,
    status: first.status,
    pembayaran,
  };
}

export function listTagihan(
  db: ConnectionPool,
  filters: ListTagihanFilters,
  page: number,
  perPage: number,
): Promise<{ rows: TagihanListRow[]; total: number }> {
  return repository.listTagihan(db, filters, page, perPage);
}

export function catatPembayaran(
  db: ConnectionPool,
  tagihanId: string,
  input: CatatPembayaranInput,
  userId: string,
  ip: string | null,
): Promise<PembayaranResult> {
  return repository.catatPembayaranViaSp(db, {
    tagihanId,
    jumlah: input.jumlah,
    jalur: input.jalur,
    dicatatOleh: userId,
    ip,
  });
}
