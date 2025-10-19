import newsScraperService from './src/services/newsScraperService';
import { Logger } from './src/utils/logger';

const logger = new Logger('NewsScraperTest');

async function testNewsScrapers() {
  try {
    logger.info('Testing Nigerian News Scrapers...\n');

    // Force refresh to bypass cache
    const news = await newsScraperService.refreshNews();

    logger.info(`\n=== SCRAPING RESULTS ===`);
    logger.info(`Total news items scraped: ${news.length}\n`);

    // Group by source
    const bySource: Record<string, number> = {};
    news.forEach(item => {
      bySource[item.source] = (bySource[item.source] || 0) + 1;
    });

    logger.info('=== BY SOURCE ===');
    Object.entries(bySource).forEach(([source, count]) => {
      const status = count > 0 ? '✅' : '❌';
      logger.info(`${status} ${source}: ${count} articles`);
    });

    if (news.length > 0) {
      logger.info(`\n=== SAMPLE NEWS (First 5) ===`);
      news.slice(0, 5).forEach((item, index) => {
        logger.info(`\n${index + 1}. ${item.title}`);
        logger.info(`   Source: ${item.source}`);
        logger.info(`   Category: ${item.category}`);
        logger.info(`   URL: ${item.url}`);
        logger.info(`   Summary: ${item.summary.substring(0, 100)}...`);
      });
    } else {
      logger.warn('No news articles were scraped. All scrapers may have failed.');
    }

    logger.info('\n=== TEST COMPLETE ===');
    process.exit(0);
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

testNewsScrapers();
