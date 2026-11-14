import type { ConnectionPool } from 'mssql';
import type { CekPasienInput, IdentitasListFilters } from './pasien.validators';
import * as repository from './pasien.repository';
import type { PasienIdentityRow } from './pasien.repository';

export interface CekPasienResult {
  terdaftar: boolean;
  pasien_id?: string;
  nama_samaran?: string;
  has_red_flag?: boolean;
}

function maskName(nama: string): string {
  return nama
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0)}***`)
    .join(' ');
}

export async function cekPasien(
  db: ConnectionPool,
  input: CekPasienInput,
): Promise<CekPasienResult> {
  const row = await repository.findByNikOrPhone(db, {
    nik: input.nik,
    noTelepon: input.no_telepon,
  });

  if (!row) return { terdaftar: false };

  return {
    terdaftar: true,
    pasien_id: row.pasien_id,
    nama_samaran: maskName(row.nama),
    has_red_flag: row.has_red_flag === true,
  };
}

export async function listIdentitas(
  db: ConnectionPool,
  filter: IdentitasListFilters,
  page: number,
  perPage: number,
): Promise<{ rows: PasienIdentityRow[]; total: number }> {
  return repository.listIdentitas(db, filter, page, perPage);
}
