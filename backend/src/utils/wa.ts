import axios from 'axios';
import { env } from '@/config/env';
import { AppError } from '@/utils/errors';

const WA_TIMEOUT_MS = 10_000;

export interface WaMessage {
  target: string;
  message: string;
}

export async function sendWa(target: string, message: string): Promise<void> {
  try {
    await axios.post<unknown>(
      env.WA_API_URL,
      { target, message } satisfies WaMessage,
      {
        timeout: WA_TIMEOUT_MS,
        headers: { Authorization: `Bearer ${env.WA_API_TOKEN}` },
      },
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new AppError(
        'ERR-NTF-01',
        `Pengiriman WhatsApp gagal: HTTP ${error.response.status}`,
      );
    }
    if (axios.isAxiosError(error)) {
      throw new AppError(
        'ERR-NTF-01',
        'Pengiriman WhatsApp gagal: timeout atau koneksi terputus',
      );
    }
    throw new AppError('ERR-NTF-01');
  }
}
