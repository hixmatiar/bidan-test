import type { ConnectionPool } from 'mssql';
import type { PaginationMeta } from '@/types/api';
import { buildMeta } from '@/utils/pagination';
import {
  listKonten,
  listLayanan,
  listSesi,
} from './repository';
import type { KontenPublicRow, LayananPublicRow, SesiPublicRow } from './repository';
import type {
  KontenListParams,
  LayananListParams,
  SesiListParams,
} from './validators';

export interface Page<T> {
  data: T[];
  meta: PaginationMeta;
}

const JAKARTA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
});

export function todayJakarta(now: Date = new Date()): string {
  return JAKARTA_DATE.format(now);
}

export async function getKontenPage(
  db: ConnectionPool,
  params: KontenListParams,
): Promise<Page<KontenPublicRow>> {
  const { total, rows } = await listKonten(db, params);
  return {
    data: rows,
    meta: buildMeta(total, params.current_page, params.per_page),
  };
}

export async function getLayananPage(
  db: ConnectionPool,
  params: LayananListParams,
): Promise<Page<LayananPublicRow>> {
  const { total, rows } = await listLayanan(db, params);
  return {
    data: rows,
    meta: buildMeta(total, params.current_page, params.per_page),
  };
}

export async function getSesiPage(
  db: ConnectionPool,
  params: SesiListParams,
): Promise<Page<SesiPublicRow>> {
  const { total, rows } = await listSesi(db, params, todayJakarta());
  return {
    data: rows,
    meta: buildMeta(total, params.current_page, params.per_page),
  };
}
