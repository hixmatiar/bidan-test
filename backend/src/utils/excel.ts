import ExcelJS from 'exceljs';

export type ExcelCell = string | number | null;

export interface ExcelSheetDef {
  sheet: string;
  columns: string[];
  rows: ExcelCell[][];
}

function todayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function buildExcelWorkbook(sheets: ExcelSheetDef[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const def of sheets) {
    const ws = wb.addWorksheet(def.sheet);
    ws.addRow(def.columns);
    for (const row of def.rows) ws.addRow(row);
  }
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function excelFilename(slug: string): string {
  return `laporan-${slug}-${todayJakarta()}.xlsx`;
}

export const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
