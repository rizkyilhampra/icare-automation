import crypto from 'crypto';
import logger from '../logger';
import { delay, DELAYS } from '../lib/browser';
import { decompressFromEncodedURIComponent } from '../lib/compression';
import { Browser } from 'playwright';

interface BpjsApiResponse {
  response: string;
  metaData?: {
    code: number;
    message: string;
  };
}

interface BpjsValidationRequest {
  param: string;
  kodedokter: number;
}

function stringDecrypt(key: string, encryptedString: string): string {
  const hash = crypto.createHash('sha256').update(key, 'utf8').digest();
  const encryptionKey = hash;
  const iv = hash.subarray(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
  let decrypted = decipher.update(encryptedString, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

async function makeApiRequest(data: BpjsValidationRequest, timestamp: string): Promise<BpjsApiResponse> {
  await delay(DELAYS.BEFORE_ACTION, 'before calling BPJS API');

  const consid = process.env.BPJS_CONS_ID;
  const secretkey = process.env.BPJS_SECRET_KEY;
  const userKey = process.env.BPJS_USER_KEY;

  if (!consid || !secretkey || !userKey) {
    throw new Error('BPJS API credentials not configured');
  }

  const signature = crypto.createHmac('sha256', secretkey)
    .update(`${consid}&${timestamp}`)
    .digest('base64');

  const response = await fetch(
    'https://apijkn.bpjs-kesehatan.go.id/wsihs/api/rs/validate',
    {
      method: 'POST',
      headers: {
        'X-cons-id': consid,
        'X-timestamp': timestamp,
        'X-signature': signature,
        'user_key': userKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
  }

  const responseData = await response.json() as BpjsApiResponse;

  return responseData;
}

export async function agreeToVerification(browser: Browser, verificationUrl: string): Promise<boolean> {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(verificationUrl);
    
    const agreeButtonSelector = 'button.swal2-confirm:has-text("Setuju")';
    
    await page.waitForSelector(agreeButtonSelector, { timeout: 30000 });
    
    logger.info('Found "Setuju" button, clicking...', { service: 'icare' });
    await page.click(agreeButtonSelector);
    
    await page.waitForTimeout(5000); 

    logger.info('Successfully clicked "Setuju" button.', { service: 'icare' });
    
    return true;
  } catch (error) {
    logger.error('Failed to agree to verification via Playwright', {
      service: 'icare',
      url: verificationUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  } finally {
    await context.close();
  }
}

export async function verifyPatient(bpjsNumber: string, doctorCode: string): Promise<string | null> {
  try {
    const consid = process.env.BPJS_CONS_ID;
    const secretkey = process.env.BPJS_SECRET_KEY;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    if (!consid || !secretkey) {
      throw new Error('BPJS credentials not configured');
    }

    const requestData: BpjsValidationRequest = {
      param: bpjsNumber,
      kodedokter: parseInt(doctorCode, 10)
    };

    logger.debug('Making BPJS API request', { 
      service: 'icare',
      bpjsNumber,
      doctorCode,
      timestamp
    });

    const response = await makeApiRequest(requestData, timestamp);

    if (!response?.response) {
      throw new Error('Invalid API response from BPJS');
    }

    logger.debug('BPJS response received', {
      service: 'icare',
      metaData: response.metaData,
      response: response.response
    });

    const decryptKey = consid + secretkey + timestamp;

    const decrypted = stringDecrypt(decryptKey, response.response);
    const decompressed = decompressFromEncodedURIComponent(decrypted);

    logger.debug('BPJS decryption successful', {
      service: 'icare',
      timestampUsedForDecryption: timestamp,
      decrypted: decrypted,
      decompressed: decompressed
    });

    if (!decompressed) {
      throw new Error('Failed to decompress BPJS response');
    }

    const parsedResponse = JSON.parse(decompressed);

    logger.debug('BPJS parsed response', {
      service: 'icare',
      parsedResponse
    });

    return parsedResponse.url || null;

  } catch (error) {
    let errorDetails: object;
    if (error instanceof Error) {
      errorDetails = { 
        message: error.message, 
        name: error.name,
        code: (error as any).code,
        stack: error.stack 
      };
    } else {
      errorDetails = { error };
    }

    logger.warn('BPJS verification failed', {
      service: 'icare',
      ...errorDetails
    });
    return null;
  }
} 