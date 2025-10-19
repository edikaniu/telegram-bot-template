import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

const parseNumberArray = (str: string | undefined): number[] => {
  if (!str) return [];
  return str.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
};

export const config: BotConfig = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  adminIds: parseNumberArray(process.env.BOT_ADMIN_IDS),
  allowedGroupIds: parseNumberArray(process.env.ALLOWED_GROUP_IDS),
  marketUpdateInterval: parseInt(process.env.MARKET_UPDATE_INTERVAL || '30'),
  newsCheckInterval: parseInt(process.env.NEWS_CHECK_INTERVAL || '15'),
};

// Validate required config
if (!config.telegramToken) {
  throw new Error('TELEGRAM_BOT_TOKEN is required in .env file');
}

export default config;
