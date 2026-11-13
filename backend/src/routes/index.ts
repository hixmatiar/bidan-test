import { Router } from 'express';
import alergiRoutes from './alergi.routes';
import auditLogsRoutes from './auditLogs.routes';
import authRoutes from './auth.routes';
import hargaRoutes from './harga.routes';
import inventarisRoutes from './inventaris.routes';
import keuanganRoutes from './keuangan.routes';
import kontenRoutes from './konten.routes';
import kunjunganRoutes from './kunjungan.routes';
import laporanRoutes from './laporan.routes';
import notifikasiRoutes from './notifikasi.routes';
import pasienRoutes from './pasien.routes';
import publicRoutes from './public.routes';
import reservasiRoutes from './reservasi.routes';
import sesiRoutes from './sesi.routes';
import tagihanRoutes from './tagihan.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/public', publicRoutes);
router.use('/pasien', pasienRoutes);
router.use('/reservasi', reservasiRoutes);
router.use('/sesi', sesiRoutes);
router.use('/alergi', alergiRoutes);
router.use('/kunjungan', kunjunganRoutes);
router.use('/tagihan', tagihanRoutes);
router.use('/keuangan', keuanganRoutes);
router.use('/inventaris', inventarisRoutes);
router.use('/harga', hargaRoutes);
router.use('/laporan', laporanRoutes);
router.use('/konten', kontenRoutes);
router.use('/notifikasi', notifikasiRoutes);
router.use('/audit-logs', auditLogsRoutes);

export default router;
