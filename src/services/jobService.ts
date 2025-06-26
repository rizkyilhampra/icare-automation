import { getDb } from '../lib/sqlite';
import { verifyPatient, agreeToVerification } from './bpjsService';
import { sendTelegramMessage } from './telegram';
import { Job, Patient } from '../types';
import logger from '../logger';
import { delay, DELAYS, getBrowser } from '../lib/browser';

const maxAttempts = parseInt(process.env.MAX_ATTEMPTS || '3');

export function enqueueJobs(patients: Patient[]): number[] {
  const db = getDb();
  const checkStmt = db.prepare(`
    SELECT id FROM jobs 
    WHERE visitNumber = ? AND date(created_at) = date('now', 'localtime')
  `);
  const insertStmt = db.prepare(`
    INSERT INTO jobs (visitNumber, bpjsNumber, doctorCode, clinicName)
    VALUES (@visitNumber, @bpjsNumber, @doctorCode, @clinicName)
  `);

  const ids: number[] = [];
  const insertMany = db.transaction((patientsList: Patient[]) => {
    for (const p of patientsList) {
      const existingJob = checkStmt.get(p.visitNumber);
      if (!existingJob) {
        const result = insertStmt.run(p);
        ids.push(result.lastInsertRowid as number);
      }
    }
  });

  insertMany(patients);
  return ids;
}

async function handleFailedJob(job: Job, error: any) {
  const db = getDb();
  const attempt = (job.attempt || 0) + 1;
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (attempt >= maxAttempts) {
    db.prepare('UPDATE jobs SET status = ?, response_data = ? WHERE id = ?').run('failed', errorMessage, job.id);
    await sendTelegramMessage(`Job ${job.id} failed after ${maxAttempts} attempts: ${errorMessage}`);
    logger.error(`Job ${job.id} failed permanently after ${maxAttempts} attempts`, { service: 'icare', error });
  } else {
    db.prepare('UPDATE jobs SET attempt = ?, response_data = ? WHERE id = ?').run(attempt, errorMessage, job.id);
    logger.warn(`Job ${job.id} attempt ${attempt} failed. Will retry.`, { service: 'icare', error });
  }
}

async function processJob(job: Job): Promise<void> {
  const db = getDb();
  try {
    const verificationUrl = await verifyPatient(job.bpjsNumber, job.doctorCode);
    
    if (!verificationUrl) {
      throw new Error('Verification URL not found');
    }
    
    const browser = await getBrowser();
    const agreed = await agreeToVerification(browser, verificationUrl);

    if (agreed) {
      db.prepare('UPDATE jobs SET status = ?, response_data = ? WHERE id = ?').run('done', verificationUrl, job.id);
      logger.info(`Job ${job.id} completed successfully`, { 
        service: 'icare',
        url: verificationUrl
      });
    } else {
      throw new Error('Playwright automation failed to agree.');
    }
  } catch (error) {
    await handleFailedJob(job, error);
  }
}

export async function processPendingJobs(jobIds?: number[]): Promise<void> {
  const db = getDb();
  let pendingJobs: Job[];

  if (jobIds && jobIds.length > 0) {
    const placeholders = jobIds.map(() => '?').join(',');
    pendingJobs = db.prepare(`
      SELECT * FROM jobs 
      WHERE id IN (${placeholders}) AND status = 'pending'
      ORDER BY id ASC
    `).all(...jobIds) as Job[];
  } else {
    pendingJobs = db.prepare(`
      SELECT * FROM jobs 
      WHERE status = 'pending' 
      ORDER BY id ASC
    `).all() as Job[];
  }

  if (pendingJobs.length === 0) {
    if (jobIds && jobIds.length > 0) {
      logger.info('No new jobs to process.', { service: 'icare' });
    }
    return;
  }

  const queue = pendingJobs;
  logger.info(`Processing ${queue.length} pending jobs sequentially`, { service: 'icare' });

  try {
    for (const job of queue) {
      await delay(DELAYS.BETWEEN_JOBS, `before processing job ${job.id}`);
      await processJob(job);
    }

    sendTelegramMessage(`${queue.length} jobs processed`);
  } catch (error) {
    logger.error('Error processing jobs', { service: 'icare', error });
  }
} 
