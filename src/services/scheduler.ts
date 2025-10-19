import * as cron from 'node-cron';
import { Telegraf } from 'telegraf';
import marketDataService from './marketData';
import aiService from './aiService';
import { Logger } from '../utils/logger';
import InputValidator from '../utils/inputValidator';
import config from '../config';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('Scheduler');

export class SchedulerService {
  private bot: Telegraf;
  private marketCheckTask?: cron.ScheduledTask;
  private newsCheckTask?: cron.ScheduledTask;
  private targetGroupIds: number[] = [];
  private sentNewsUrls: Set<string> = new Set(); // Track sent news URLs to prevent duplicates
  private sentNewsFile: string = path.join(process.cwd(), 'data', 'sent_news_urls.json');

  constructor(bot: Telegraf) {
    this.bot = bot;
    this.loadSentNewsUrls();
  }

  /**
   * Load previously sent news URLs from disk
   */
  private loadSentNewsUrls(): void {
    try {
      if (fs.existsSync(this.sentNewsFile)) {
        const data = fs.readFileSync(this.sentNewsFile, 'utf-8');
        const urls = JSON.parse(data);
        this.sentNewsUrls = new Set(urls);
        logger.info(`Loaded ${this.sentNewsUrls.size} previously sent news URLs`);
      }
    } catch (error) {
      logger.error('Error loading sent news URLs:', error);
    }
  }

  /**
   * Save sent news URLs to disk
   */
  private saveSentNewsUrls(): void {
    try {
      const urls = Array.from(this.sentNewsUrls);
      fs.writeFileSync(this.sentNewsFile, JSON.stringify(urls, null, 2));
      logger.debug('Saved sent news URLs to disk');
    } catch (error) {
      logger.error('Error saving sent news URLs:', error);
    }
  }

  /**
   * Set target groups for automated messages
   */
  setTargetGroups(groupIds: number[]): void {
    this.targetGroupIds = groupIds;
    logger.info(`Target groups set: ${groupIds.length} groups`);
  }

  /**
   * Start all scheduled tasks
   */
  start(): void {
    this.startMarketMonitoring();
    this.startNewsMonitoring();
    this.startWeeklyDataRefresh();
    logger.info('All scheduled tasks started');
  }

  /**
   * Stop all scheduled tasks
   */
  stop(): void {
    if (this.marketCheckTask) {
      this.marketCheckTask.stop();
      logger.info('Market monitoring stopped');
    }
    if (this.newsCheckTask) {
      this.newsCheckTask.stop();
      logger.info('News monitoring stopped');
    }
  }

  /**
   * Monitor funds for significant performance changes and trigger conversations
   */
  private startMarketMonitoring(): void {
    // Run daily at 3pm Nigerian time (15:00)
    const interval = '0 15 * * *';

    this.marketCheckTask = cron.schedule(interval, async () => {
      try {
        logger.info('Checking for fund performance triggers...');
        const triggers = await marketDataService.checkFundTriggers();

        if (triggers.length > 0) {
          logger.info(`Found ${triggers.length} fund trigger(s)`);

          for (const trigger of triggers) {
            // Generate AI commentary for the trigger
            const message = await aiService.generateMarketTriggerMessage(trigger);

            // Send to all target groups
            await this.broadcastToGroups(message);
          }
        } else {
          logger.debug('No fund performance triggers found');
        }
      } catch (error) {
        logger.error('Error in fund monitoring task:', error);
      }
    });

    logger.info('Fund monitoring scheduled: daily at 3:00 PM Nigerian time');
  }

  /**
   * Monitor and share financial news (only new/unsent news)
   */
  private startNewsMonitoring(): void {
    // Run every 6 hours (0, 6, 12, 18)
    const interval = '0 */6 * * *';

    this.newsCheckTask = cron.schedule(interval, async () => {
      try {
        logger.info('Checking for financial news...');
        const allNews = await marketDataService.getFinancialNews(10); // Get more to filter from

        // Filter out news that have already been sent
        const newNews = allNews.filter(item => {
          if (!item.url) return false; // Skip items without URL
          return !this.sentNewsUrls.has(item.url);
        });

        if (newNews.length > 0) {
          // Limit to top 5 new items
          const newsToSend = newNews.slice(0, 5);

          let newsMessage = '📰 *Latest Financial News*\n\n';

          newsToSend.forEach((item, index) => {
            const categoryEmoji: Record<string, string> = {
              market: '📈',
              funds: '💰',
              economy: '🏦',
              policy: '📋',
              stocks: '📊',
              tech: '💻',
            };
            const emoji = categoryEmoji[item.category] || '📰';

            // Clean text for Telegram without over-escaping
            const cleanTitle = item.title.replace(/[_*[\]()~`>#+=|{}.!-]/g, '');
            const cleanSummary = item.summary.replace(/[_*[\]()~`>#+=|{}.!-]/g, '');
            const cleanSource = item.source.replace(/[_*[\]()~`>#+=|{}.!-]/g, '');

            if (index > 0) newsMessage += '\n';
            newsMessage += `${emoji} ${cleanTitle}\n`;
            newsMessage += `${cleanSummary}\n`;
            if (item.url) {
              newsMessage += `🔗 ${item.url}\n`;
            }
            newsMessage += `${cleanSource}\n`;

            // Mark this news URL as sent
            if (item.url) {
              this.sentNewsUrls.add(item.url);
            }
          });

          logger.info(`Broadcasting ${newsToSend.length} new news items (filtered ${allNews.length - newNews.length} duplicates)`);
          await this.broadcastToGroups(newsMessage);

          // Save sent URLs to disk
          this.saveSentNewsUrls();

          // Clean up old URLs to prevent memory leak (keep only last 200)
          if (this.sentNewsUrls.size > 200) {
            const urlsArray = Array.from(this.sentNewsUrls);
            this.sentNewsUrls = new Set(urlsArray.slice(-200));
            this.saveSentNewsUrls(); // Save after cleanup
            logger.debug(`Cleaned up sent news URLs cache (kept last 200)`);
          }
        } else {
          logger.info('No new news items to broadcast (all already sent)');
        }
      } catch (error) {
        logger.error('Error in news monitoring task:', error);
      }
    });

    logger.info('News monitoring scheduled: every 6 hours');
  }

  /** Send daily fund performance summary at specified time
   * @param hour Hour in UTC (Railway servers use UTC timezone)
   * @param minute Minute (0-59)
   * Note: Nigeria is UTC+1, so hour=8 means 9 AM Nigerian time
   */
  startDailySummary(hour: number = 8, minute: number = 0): void {
    // Schedule for specific time in UTC
    const schedule = `${minute} ${hour} * * *`;

    cron.schedule(schedule, async () => {
      try {
        logger.info('Sending daily fund performance summary...');
        const summary = await marketDataService.getFundsSummary();

        const message = `🌅 *Good Morning! Daily Mutual Funds Overview*\n\n${summary}\n\nHave a great investment day! 💰`;

        await this.broadcastToGroups(message);
        logger.info('Daily fund summary sent successfully');
      } catch (error) {
        logger.error('Error sending daily summary:', error);
      }
    });

    logger.info(`Daily fund summary scheduled for ${hour}:${minute} UTC (${hour + 1}:${minute} Nigerian time)`);
  }

  /**
   * Send weekly fund performance roundup
   * @param dayOfWeek Day of week (0=Sunday, 5=Friday)
   * @param hour Hour in UTC (Railway servers use UTC timezone)
   * @param minute Minute (0-59)
   * Note: Nigeria is UTC+1, so hour=16 means 5 PM Nigerian time
   */
  startWeeklyRoundup(dayOfWeek: number = 5, hour: number = 16, minute: number = 0): void {
    // dayOfWeek: 0 = Sunday, 5 = Friday
    const schedule = `${minute} ${hour} * * ${dayOfWeek}`;

    cron.schedule(schedule, async () => {
      try {
        logger.info('Sending weekly fund roundup...');
        const summary = await marketDataService.getFundsSummary();

        const message = `🎉 *Week End Mutual Funds Roundup*\n\n${summary}\n\nHave a wonderful weekend! See you next week! 👋`;

        await this.broadcastToGroups(message);
        logger.info('Weekly roundup sent successfully');
      } catch (error) {
        logger.error('Error sending weekly roundup:', error);
      }
    });

    logger.info(`Weekly fund roundup scheduled for ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]} at ${hour}:${minute} UTC (${hour + 1}:${minute} Nigerian time)`);
  }

  /**
   * Daily data refresh - scrapes fresh data every day at 6 AM Nigerian time
   * Changed from weekly to daily for more up-to-date financial data
   */
  private startWeeklyDataRefresh(): void {
    // Schedule for daily at 6 AM Nigerian time = 5 AM UTC (Nigeria is UTC+1)
    const schedule = '0 5 * * *';  // minute=0, hour=5 (UTC), every day

    cron.schedule(schedule, async () => {
      try {
        logger.info('🔄 Starting daily data refresh (6 AM Nigerian time)...');

        const scraperService = require('./scraperService').default;
        const freshFunds = await scraperService.scrapeFunds();

        if (freshFunds && freshFunds.length > 0) {
          logger.info(`✅ Daily data refresh completed! Scraped ${freshFunds.length} funds`);

          // Optionally notify admin groups (only on significant changes or errors)
          if (this.targetGroupIds.length > 0 && freshFunds.length < 10) {
            const message = `⚠️ *Data Update Warning*\n\n` +
              `Daily refresh completed but only ${freshFunds.length} funds were found.\n` +
              `This might indicate a scraping issue.`;
            await this.broadcastToGroups(message);
          }
        } else {
          logger.error('❌ Daily data refresh failed - no funds scraped');

          // Notify admin groups of failure
          if (this.targetGroupIds.length > 0) {
            const message = `❌ *Data Update Failed*\n\n` +
              `Daily refresh failed to scrape fund data.\n` +
              `Please check the scraper service.`;
            await this.broadcastToGroups(message);
          }
        }
      } catch (error) {
        logger.error('❌ Error during daily data refresh:', error);

        // Notify admin groups of error
        if (this.targetGroupIds.length > 0) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const message = `❌ *Data Update Error*\n\n` +
            `Daily refresh encountered an error:\n${errorMsg}`;
          await this.broadcastToGroups(message).catch(() => {
            logger.error('Failed to send error notification to groups');
          });
        }
      }
    });

    logger.info('📅 Daily data refresh scheduled: Every day at 6:00 AM Nigerian time (5:00 AM UTC)');
  }

  /**
   * Broadcast message to all target groups
   */
  private async broadcastToGroups(message: string): Promise<void> {
    if (this.targetGroupIds.length === 0) {
      logger.warn('No target groups configured for broadcast');
      return;
    }

    for (const groupId of this.targetGroupIds) {
      try {
        await this.bot.telegram.sendMessage(groupId, message, {
          parse_mode: 'Markdown',
        });
        logger.info(`Message sent to group ${groupId}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error(`Failed to send message to group ${groupId}:`, error);
      }
    }
  }
}
