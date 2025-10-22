import cron from 'node-cron';
import { fetchTodayPatients } from './services/simrsService';
import { enqueueJobs, processPendingJobs } from './services/jobService';
import { HolidayService } from './services/holidayService';
import { sendTelegramMessage } from './services/telegram';
import { getDb } from './lib/sqlite';
import logger from './logger';

function isEndOfSchedule(): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

  // Saturday schedule ends at 13:50
  if (currentDay === 6) {
    return currentHour === 13 && currentMinute === 50;
  }

  // Weekday schedule ends at 17:50
  if (currentDay >= 1 && currentDay <= 5) {
    return currentHour === 17 && currentMinute === 50;
  }

  return false;
}

async function sendDailySummary(): Promise<void> {
  const db = getDb();

  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM jobs
      WHERE date(created_at) = date('now', 'localtime')
    `).get() as { total: number; completed: number; failed: number; pending: number };

    if (stats.total === 0) {
      logger.info('No jobs processed today, skipping summary', { service: 'scheduler' });
      return;
    }

    const message = `Daily Summary:\n` +
      `Total jobs: ${stats.total}\n` +
      `✓ Completed: ${stats.completed}\n` +
      `✗ Failed: ${stats.failed}\n` +
      `⏳ Pending: ${stats.pending}`;

    await sendTelegramMessage(message);
    logger.info('Daily summary sent', {
      service: 'scheduler',
      stats
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to send daily summary', {
      service: 'scheduler',
      error: errorMessage
    });
  }
}

async function shouldRunScheduledJob(): Promise<boolean> {
  const holidayService = HolidayService.getInstance();
  const now = new Date();

  try {
    if (await holidayService.isHoliday(now)) {
      const holidayInfo = await holidayService.getHolidayInfo(now);
      logger.info('Skipping scheduled job - today is an Indonesian holiday', {
        service: 'scheduler',
        date: now.toISOString().split('T')[0],
        holiday: holidayInfo
      });
      return false;
    }

    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error checking holiday status, proceeding with job', {
      service: 'scheduler',
      error: errorMessage
    });
    return true;
  }
}

async function runScheduledJob(): Promise<void> {
  if (!(await shouldRunScheduledJob())) {
    return;
  }

  logger.info('Running scheduled job: checking for new patients...', { service: 'scheduler' });

  try {
    const patients = await fetchTodayPatients();
    if (patients.length === 0) {
      logger.info('No patients found for today in SIMRS.', { service: 'scheduler' });
    } else {
      const newJobIds = enqueueJobs(patients);
      if (newJobIds.length > 0) {
        logger.info(`Enqueued ${newJobIds.length} new patient jobs. Processing them now.`, {
          service: 'scheduler',
          jobIds: newJobIds
        });
        await processPendingJobs(newJobIds);
        logger.info(`Finished processing ${newJobIds.length} new jobs.`, { service: 'scheduler' });
      } else {
        logger.info('No new patients to enqueue since last check.', { service: 'scheduler' });
      }
    }

    // Send daily summary at the end of the schedule
    if (isEndOfSchedule()) {
      logger.info('End of schedule reached, sending daily summary', { service: 'scheduler' });
      await sendDailySummary();
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Scheduled job failed', {
      service: 'scheduler',
      error: errorMessage
    });
  }
}

export function registerCronJobs(): void {
  const holidayService = HolidayService.getInstance();
  
  holidayService.cleanExpiredCache();
  
  const weekdayCron = process.env.WEEKDAY_CRON || '*/10 16-17 * * 1-5';
  
  const saturdayCron = process.env.SATURDAY_CRON || '*/10 12-13 * * 6';
  
  logger.info(`Registering weekday cron job: "${weekdayCron}"`, { service: 'scheduler' });
  logger.info(`Registering Saturday cron job: "${saturdayCron}"`, { service: 'scheduler' });
  
  holidayService.getUpcomingHolidays().then(upcomingHolidays => {
    if (upcomingHolidays.length > 0) {
      logger.info('Upcoming Indonesian holidays:', {
        service: 'scheduler',
        holidays: upcomingHolidays
      });
    }
  }).catch((error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Could not pre-fetch holiday data', {
      service: 'scheduler',
      error: errorMessage
    });
  });
  
  cron.schedule('0 0 * * *', () => {
    logger.info('Running daily cache cleanup', { service: 'holiday-service' });
    holidayService.cleanExpiredCache();
  });
  
  cron.schedule(weekdayCron, runScheduledJob);
  
  cron.schedule(saturdayCron, runScheduledJob);
} 
