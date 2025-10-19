import scraperService from './src/services/scraperService';
import { Logger } from './src/utils/logger';

const logger = new Logger('ScraperTest');

async function testScraper() {
  try {
    logger.info('Testing NairaCompare scraper...');

    const funds = await scraperService.scrapeFunds();

    logger.info(`\n=== SCRAPING RESULTS ===`);
    logger.info(`Total funds scraped: ${funds.length}`);

    if (funds.length > 0) {
      logger.info(`\n=== SAMPLE FUNDS ===`);
      funds.slice(0, 5).forEach((fund, index) => {
        logger.info(`\n${index + 1}. ${fund.name}`);
        logger.info(`   Provider: ${fund.fundManager}`);
        logger.info(`   Type: ${fund.type}`);
        if (fund.yieldToDate) {
          logger.info(`   Yield: ${fund.yieldToDate}`);
        }
        if (fund.minimumInvestment) {
          logger.info(`   Min. Investment: ${fund.minimumInvestment}`);
        }
        if (fund.riskProfile) {
          logger.info(`   Risk: ${fund.riskProfile}`);
        }
      });
    } else {
      logger.warn('No funds were scraped. Check the page selectors.');
    }

    logger.info('\n=== TEST COMPLETE ===');
    process.exit(0);
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

testScraper();
