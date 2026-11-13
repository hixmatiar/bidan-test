import type { PaginationMeta } from '../types/api';
import { AppError } from './errors';

const DEFAULT_PER_PAGE = 15;
const MAX_PER_PAGE = 100;

function toInt(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  throw new AppError('ERR-VAL-03', `Nilai ${field} harus berupa angka bulat`);
}

export function parsePagination(
  body: unknown,
): Pick<PaginationMeta, 'current_page' | 'per_page'> {
  const src = (body ?? {}) as Record<string, unknown>;

  let perPage = toInt(src.per_page, 'per_page') ?? DEFAULT_PER_PAGE;
  if (perPage < 1) perPage = DEFAULT_PER_PAGE;
  if (perPage > MAX_PER_PAGE) perPage = MAX_PER_PAGE;

  // ponytail: `page` is the request field, `current_page` accepted as alias
  let page = toInt(src.page ?? src.current_page, 'page') ?? 1;
  if (page < 1) page = 1;

  return { current_page: page, per_page: perPage };
}

export function buildMeta(
  total: number,
  page: number,
  perPage: number,
): PaginationMeta {
  return {
    current_page: page,
    per_page: perPage,
    total,
    last_page: Math.max(1, Math.ceil(total / perPage)),
  };
}
