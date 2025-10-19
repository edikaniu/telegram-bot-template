import scraperService from './src/services/scraperService';
import { Logger } from './src/utils/logger';
import * as fs from 'fs';

const logger = new Logger('ScrapeMM');

async function scrapeMM() {
  try {
    logger.info('Scraping ONLY money market funds...');

    const funds = await scraperService.scrapeFunds();

    const mmFunds = funds.filter(f => f.type === 'money_market');

    logger.info(`\n=== MONEY MARKET FUNDS (${mmFunds.length} total) ===\n`);

    mmFunds.forEach((fund, i) => {
      logger.info(`${i + 1}. ${fund.name}`);
      logger.info(`   Provider: ${fund.fundManager}`);
      logger.info(`   Yield: ${fund.yieldToDate || 'NO DATA'}`);
      logger.info(`   Min Investment: ${fund.minimumInvestment || 'NO DATA'}`);
      logger.info(`   Risk: ${fund.riskProfile || 'NO DATA'}`);
      logger.info('');
    });

    process.exit(0);
  } catch (error) {
    logger.error('Scraping failed:', error);
    process.exit(1);
  }
}

scrapeMM();
