import { chromium, Browser } from 'playwright';
import logger from '../logger';

export const DELAYS = {
  BEFORE_LAUNCH: 0,
  BEFORE_ACTION: 0,
  BETWEEN_JOBS: 30_000
};

function resolveHeadless() {
  const env = process.env.HEADLESS?.toLowerCase();
  if (env === 'true' || env === '1') return true;
  if (env === 'false' || env === '0') return false;
  return process.env.NODE_ENV === 'production';
}

const HEADLESS = resolveHeadless();

let browser: Browser | null = null;

export async function delay(ms: number, action: string) {
  logger.debug(`Waiting ${ms}ms ${action}...`, { service: 'icare' });
  await new Promise(resolve => setTimeout(resolve, ms));
}

export async function initBrowser() {
  if (browser) {
    logger.info('Browser already initialized', { service: 'icare' });
    return;
  }

  const mode = HEADLESS ? 'headless' : 'headed';
  logger.info(`Launching a ${mode} browser instance...`, { service: 'icare' });

  await delay(DELAYS.BEFORE_LAUNCH, 'before launching browser');

  browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  logger.info('Browser instance ready', { service: 'icare' });
}

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    await initBrowser();
  }
  return browser as Browser;
}

export async function closeBrowser() {
  if (!browser) return;

  logger.info('Closing browser', { service: 'icare' });

  await browser.close();
  browser = null;

  logger.info('Browser closed', { service: 'icare' });
} 