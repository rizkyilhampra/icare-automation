import TelegramBot from 'node-telegram-bot-api';
import logger from '../logger';

let bot: TelegramBot | null = null;

function getBot(): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  if (!bot) {
    bot = new TelegramBot(token, { polling: false });
  }
  return bot;
}

export async function sendTelegramMessage(message: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const tg = getBot();
  if (!tg || !chatId) {
    logger.warn('Telegram not configured, message not sent', { service: 'telegram' });
    return;
  }
  try {
    await tg.sendMessage(chatId, '[icare] ' + message, { parse_mode: 'MarkdownV2' });
  } catch (error) {
    logger.error('Failed to send Telegram message', { service: 'telegram', error });
  }
} 
