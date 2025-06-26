import Database from 'better-sqlite3';
import path from 'path';
import logger from '../logger';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export async function initDb() {
  const defaultDir = path.resolve(__dirname, '../../data');
  const dbPath = process.env.SQLITE_FILE || path.join(defaultDir, 'icare.sqlite3');
  try {
    require('fs').mkdirSync(path.dirname(dbPath), { recursive: true });
  } catch (e) {
    logger.error('Error creating directory:', e);
  }
  db = new Database(dbPath);

  const createJobsTable = `
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitNumber TEXT,
      bpjsNumber TEXT,
      doctorCode TEXT,
      clinicName TEXT,
      status TEXT DEFAULT 'pending',
      attempt INTEGER DEFAULT 0,
      response_data TEXT,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    );
  `;
  db.exec(createJobsTable);
  db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at);');

 const createHolidayCacheTable = `
      CREATE TABLE IF NOT EXISTS holiday_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER UNIQUE,
        data TEXT NOT NULL,
        cached_at DATETIME DEFAULT (datetime('now', 'localtime')),
        expires_at DATETIME NOT NULL
      );
    `;
    
  db.exec(createHolidayCacheTable);
  db.exec('CREATE INDEX IF NOT EXISTS idx_holiday_cache_year ON holiday_cache (year);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_holiday_cache_expires ON holiday_cache (expires_at);');
  
  logger.info('SQLite database ready');
} 