import { env } from '@/config/env';
import { scheduleInventoryWeekly } from './inventoryWeekly.job';
import { scheduleReminderH1 } from './reminderH1.job';

export async function startJobs(): Promise<void> {
  if (env.NODE_ENV === 'test') return;
  try {
    scheduleReminderH1();
    scheduleInventoryWeekly();
  } catch (error) {
    console.error('[jobs] gagal mendaftarkan cron jobs', error);
  }
}

export { runReminderH1 } from './reminderH1.job';
export { runInventoryWeekly } from './inventoryWeekly.job';
