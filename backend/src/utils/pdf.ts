import PDFDocument from 'pdfkit';
import type {
  AlergiRow,
  KunjunganDenganResep,
  ProfilRmeRow,
} from '@/modules/rme/rme.repository';
import { dateTimeJakarta, dateTimeWib } from './date';

export interface RmePdfInput {
  pasien: ProfilRmeRow;
  alergi_aktif: AlergiRow[];
  kunjungan: KunjunganDenganResep[];
  generated_at: string;
}

const PAGE_MARGIN = 40;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;
const BOTTOM_LIMIT = 841.89 - PAGE_MARGIN - 30;

const COLUMNS = [
  { key: 'tanggal', label: 'Tanggal', width: 78 },
  { key: 'diagnosis', label: 'Diagnosis', width: 145 },
  { key: 'tindakan', label: 'Tindakan', width: 145 },
  { key: 'resep', label: 'Resep', width: CONTENT_WIDTH - 78 - 145 - 145 },
] as const;

const RED_FLAG_CATEGORIES = new Set(['ALERGI_OBAT', 'KEHAMILAN_RISTI']);

function visitDate(value: Date | string): string {
  return dateTimeJakarta(new Date(value));
}

function resepLines(kunjungan: KunjunganDenganResep): string {
  if (kunjungan.resep.length === 0) return '-';
  return kunjungan.resep
    .map((item) => {
      const aturan = item.aturan_pakai ? ` (${item.aturan_pakai})` : '';
      return `${item.item_nama} ${item.jumlah} ${item.satuan}${aturan}`;
    })
    .join('\n');
}

function textHeight(doc: PDFKit.PDFDocument, text: string, width: number): number {
  return doc.heightOfString(text, { width, lineGap: 1 });
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  const height = 20;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, height).fill('#e5e7eb');
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9);

  let x = PAGE_MARGIN;
  for (const column of COLUMNS) {
    doc.text(column.label, x + 4, y + 6, { width: column.width - 8 });
    x += column.width;
  }

  doc
    .moveTo(PAGE_MARGIN, y + height)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + height)
    .strokeColor('#9ca3af')
    .stroke();

  return y + height;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  y: number,
  values: Record<string, string>,
): number {
  doc.font('Helvetica').fontSize(8).fillColor('#111827');

  const heights = COLUMNS.map((column) =>
    textHeight(doc, values[column.key] ?? '', column.width - 8),
  );
  const rowHeight = Math.max(...heights, 12) + 8;

  let x = PAGE_MARGIN;
  for (const column of COLUMNS) {
    doc.text(values[column.key] ?? '', x + 4, y + 4, {
      width: column.width - 8,
      lineGap: 1,
    });
    x += column.width;
  }

  doc
    .moveTo(PAGE_MARGIN, y + rowHeight)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + rowHeight)
    .strokeColor('#e5e7eb')
    .stroke();

  return y + rowHeight;
}

function drawFooter(doc: PDFKit.PDFDocument, generatedAt: string): void {
  const y = 841.89 - PAGE_MARGIN - 12;
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#6b7280')
    .text(
      `Dicetak dari Sistem Digitalisasi Praktik Mandiri Bidan - ${generatedAt}`,
      PAGE_MARGIN,
      y,
      { width: CONTENT_WIDTH, align: 'center' },
    );
}

export function buildRmePdf(input: RmePdfInput): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE_MARGIN,
    info: {
      Title: `Rekam Medis Elektronik - ${input.pasien.nama}`,
      Author: 'Sistem Digitalisasi Praktik Mandiri Bidan',
      Subject: 'Ringkasan Rekam Medis Elektronik',
    },
  });

  doc.on('pageAdded', () => drawFooter(doc, input.generated_at));

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#111827')
    .text('PRAKTIK MANDIRI BIDAN', { align: 'center' });
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#374151')
    .text('Bdn. Ria Indrasti J., S.Keb', { align: 'center' });
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111827')
    .text('RINGKASAN REKAM MEDIS ELEKTRONIK', {
      align: 'center',
      underline: true,
    });

  doc.moveDown(0.8);
  doc
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .strokeColor('#111827')
    .stroke();
  doc.moveDown(0.8);

  const pasien = input.pasien;
  const identity: Array<[string, string]> = [
    ['Nama', pasien.nama],
    ['NIK', pasien.nik],
    [
      'Tanggal lahir',
      visitDate(pasien.tgl_lahir).slice(0, 10),
    ],
    ['No. telepon', pasien.no_telepon],
    ['Alamat', pasien.alamat ?? '-'],
  ];

  doc.fontSize(10);
  for (const [label, value] of identity) {
    const y = doc.y;
    doc.font('Helvetica-Bold').fillColor('#111827').text(`${label}`, PAGE_MARGIN, y, {
      width: 95,
    });
    doc.font('Helvetica').fillColor('#111827').text(`: ${value}`, PAGE_MARGIN + 95, y, {
      width: CONTENT_WIDTH - 95,
    });
  }

  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Red-Flag & Alergi Aktif');
  doc.moveDown(0.3);

  const redFlags = input.alergi_aktif.filter((item) =>
    RED_FLAG_CATEGORIES.has(item.kategori),
  );

  if (redFlags.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor('#374151').text('Tidak ada red-flag aktif.');
  } else {
    doc.font('Helvetica').fontSize(9).fillColor('#991b1b');
    for (const item of redFlags) {
      const label = item.item_nama ?? item.nama ?? item.kategori;
      const keterangan = item.keterangan ? ` - ${item.keterangan}` : '';
      doc.text(`- [${item.kategori}] ${label}${keterangan}`);
    }
  }

  doc.moveDown(0.9);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Riwayat Kunjungan');
  doc.moveDown(0.4);

  let y = drawTableHeader(doc, doc.y);

  if (input.kunjungan.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor('#374151').text(
      'Belum ada kunjungan tercatat.',
      PAGE_MARGIN + 4,
      y + 5,
    );
    y += 22;
  } else {
    for (const kunjungan of input.kunjungan) {
      const values: Record<string, string> = {
        tanggal: visitDate(kunjungan.tanggal_kunjungan),
        diagnosis: kunjungan.diagnosis ?? '-',
        tindakan: kunjungan.tindakan ?? '-',
        resep: resepLines(kunjungan),
      };

      doc.font('Helvetica').fontSize(8);
      const heights = COLUMNS.map((column) =>
        textHeight(doc, values[column.key] ?? '', column.width - 8),
      );
      const rowHeight = Math.max(...heights, 12) + 8;

      if (y + rowHeight > BOTTOM_LIMIT) {
        doc.addPage();
        y = drawTableHeader(doc, PAGE_MARGIN);
      }

      y = drawTableRow(doc, y, values);
    }
  }

  if (y > BOTTOM_LIMIT - 20) {
    doc.addPage();
  }

  drawFooter(doc, input.generated_at);

  return doc;
}
