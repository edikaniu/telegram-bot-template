import axios from 'axios';
import { FundData, NewsItem } from '../types';
import { Logger } from '../utils/logger';
import scraperService from './scraperService';
import newsScraperService from './newsScraperService';

const logger = new Logger('MarketDataService');

export class MarketDataService {
  private newsCache: NewsItem[] = [];
  private lastNewsUpdate: Date = new Date();

  /**
   * Fetch data for Nigerian mutual funds from scraped data
   */
  async getFundData(fundType?: string): Promise<FundData[]> {
    try {
      logger.info(`Fetching fund data${fundType ? ` for type: ${fundType}` : ''}`);

      // Get funds from scraper (uses cache if fresh)
      const allFunds = await scraperService.getFunds();

      // Filter by fund type if specified
      const funds = fundType
        ? allFunds.filter(f => f.type === fundType)
        : allFunds;

      logger.info(`Returned ${funds.length} fund(s)`);
      return funds;
    } catch (error) {
      logger.error('Error fetching fund data:', error);
      // Return cached data on error
      return scraperService.getCachedFunds();
    }
  }

  /**
   * Get fund by name (fuzzy search)
   */
  async searchFund(query: string): Promise<FundData[]> {
    try {
      const allFunds = await scraperService.getFunds();
      const lowerQuery = query.toLowerCase();

      return allFunds.filter(fund =>
        fund.name.toLowerCase().includes(lowerQuery) ||
        fund.fundManager.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      logger.error('Error searching funds:', error);
      return [];
    }
  }

  /**
   * Fetch financial news relevant to Nigerian markets
   */
  async getFinancialNews(limit: number = 5, category?: string): Promise<NewsItem[]> {
    try {
      logger.info(`Fetching financial news${category ? ` for category: ${category}` : ''}...`);

      // Use the new news scraper service (it has its own caching)
      const news = await newsScraperService.getNews(category);

      logger.info(`Retrieved ${news.length} news items`);
      return news.slice(0, limit);
    } catch (error) {
      logger.error('Error fetching financial news:', error);
      return [];
    }
  }

  /**
   * Refresh news data by triggering a new scrape
   */
  async refreshNewsData(): Promise<boolean> {
    try {
      logger.info('Manually refreshing news data...');
      await newsScraperService.refreshNews();
      return true;
    } catch (error) {
      logger.error('Error refreshing news data:', error);
      return false;
    }
  }

  /**
   * Check for significant fund NAV changes that should trigger conversations
   * Returns top 5-7 high-yield funds in a SINGLE combined message
   */
  async checkFundTriggers(): Promise<string[]> {
    try {
      const funds = await this.getFundData();
      const highYieldFunds: Array<{ fund: any; yield: number }> = [];

      // Collect funds with yield > 20% (higher threshold to reduce noise)
      funds.forEach(fund => {
        if (fund.yieldToDate) {
          const yieldMatch = fund.yieldToDate.match(/([\d.]+)%/);
          if (yieldMatch) {
            const yieldValue = parseFloat(yieldMatch[1]);
            if (yieldValue > 20) {
              highYieldFunds.push({ fund, yield: yieldValue });
            }
          }
        }
      });

      // If we have high-yield funds, create ONE combined message
      if (highYieldFunds.length > 0) {
        // Sort by yield (highest first) and take top 7
        highYieldFunds.sort((a, b) => b.yield - a.yield);
        const topFunds = highYieldFunds.slice(0, 7);

        // Build combined message
        let message = `🌟 *Top High-Yield Funds Alert*\n\nToday's highest performing funds:\n\n`;

        topFunds.forEach((item, index) => {
          message += `${index + 1}. *${item.fund.name}*\n`;
          message += `   ${item.fund.fundManager}\n`;
          message += `   📈 Yield: *${item.fund.yieldToDate}*\n`;
          if (item.fund.riskProfile) message += `   🎯 Risk: ${item.fund.riskProfile}\n`;
          message += `\n`;
        });

        message += `💡 _These yields reflect current market conditions. Past performance doesn't guarantee future results._`;

        return [message];
      }

      return [];
    } catch (error) {
      logger.error('Error checking fund triggers:', error);
      return [];
    }
  }

  /**
   * Get formatted summary of mutual funds
   */
  async getFundsSummary(): Promise<string> {
    try {
      const allFunds = await this.getFundData();

      if (allFunds.length === 0) {
        return '📊 No fund data available at the moment. The bot is updating its database.';
      }

      let summary = '💰 *Nigerian Mutual Funds Overview*\n\n';

      // Group by fund type
      const fundsByType: Record<string, FundData[]> = {
        money_market: [],
        fixed_income: [],
        dollar: [],
        balance: [],
        equity: [],
      };

      allFunds.forEach(fund => {
        if (fundsByType[fund.type]) {
          fundsByType[fund.type].push(fund);
        }
      });

      // Display top 3 funds per type
      const typeNames: Record<string, string> = {
        money_market: '💵 Money Market Funds',
        fixed_income: '📊 Fixed Income Funds',
        dollar: '💲 Dollar Funds',
        balance: '⚖️ Balanced Funds',
        equity: '📈 Equity Funds',
      };

      Object.entries(fundsByType).forEach(([type, funds]) => {
        if (funds.length > 0) {
          summary += `*${typeNames[type]}*\n`;
          funds
            .slice(0, 3)
            .forEach(fund => {
              summary += `• ${fund.name} (${fund.fundManager})\n`;
              if (fund.yieldToDate) {
                summary += `  Yield: ${fund.yieldToDate}`;
              }
              summary += '\n';
            });
          summary += '\n';
        }
      });

      const lastUpdate = scraperService.getCachedFunds()[0]?.lastUpdated || new Date();
      summary += `_Data updated: ${lastUpdate.toLocaleString('en-NG')}_`;

      return summary;
    } catch (error) {
      logger.error('Error generating funds summary:', error);
      return '❌ Unable to fetch funds summary at this time. Please try again later.';
    }
  }

  /**
   * Refresh fund data by triggering a new scrape
   */
  async refreshFundData(): Promise<boolean> {
    try {
      logger.info('Manually refreshing fund data...');
      await scraperService.scrapeFunds();
      return true;
    } catch (error) {
      logger.error('Error refreshing fund data:', error);
      return false;
    }
  }
}

export default new MarketDataService();
