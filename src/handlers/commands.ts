import { Context } from 'telegraf';
import marketDataService from '../services/marketData';
import aiService from '../services/aiService';
import { Logger } from '../utils/logger';
import rateLimiter from '../utils/rateLimiter';
import InputValidator from '../utils/inputValidator';
import SecurityLogger from '../utils/securityLogger';
import errorMonitor from '../utils/errorMonitor';
import userBlocker from '../utils/userBlocker';
import healthCheck from '../utils/healthCheck';
import usageAnalytics from '../utils/usageAnalytics';
import backupService from '../utils/backupService';
import serviceHealthMonitor from '../utils/serviceHealth';
import config from '../config';
import scraperService from '../services/scraperService';

const logger = new Logger('CommandHandlers');

export class CommandHandlers {
  /**
   * /start - Welcome message
   */
  async start(ctx: Context): Promise<void> {
    const welcomeMessage = `👋 Welcome to the Nigerian Investment Bot!

I'm here to help you stay informed about Nigerian financial markets and investments.

*What I can do:*
💰 Share information about mutual funds in Nigeria
📰 Deliver financial news and insights
💬 Answer your investment questions
🔔 Trigger conversations about fund performance
📚 Educate about different fund types and strategies

*Available Commands:*
/funds - View mutual fund performance
/search [name] - Search for specific funds
/news - Latest financial news
/refresh - Update fund data (Admin only)
/help - Show this help message
/about - Learn more about this bot

You can also just chat with me about Nigerian mutual funds, investments, and financial planning!

_Note: I provide educational information, not financial advice._`;

    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
    logger.info(`Start command executed in chat ${ctx.chat?.id}`);
  }

  /**
   * /help - Show help information
   */
  async help(ctx: Context): Promise<void> {
    const helpMessage = `🤖 *Nigerian Investment Bot - Help*

*Commands:*
/start - Welcome message
/funds [type] - View mutual funds
  Types: money_market, fixed_income, dollar, balance, equity
/search [term] - Search for specific funds
/news - Latest financial news
/about - About this bot
/help - This help message

*How to use:*
• Add me to your investment group
• I'll automatically engage when mutual funds are discussed
• Ask me questions about Nigerian mutual funds and investments
• Use commands for specific information

*Topics I cover:*
💰 Money Market Funds
📊 Fixed Income Funds
💲 Dollar Funds
⚖️ Balanced Funds
📈 Equity Funds
🏦 Fund managers (Stanbic, ARM, Coronation, FCMB, Vetiva, etc.)
📰 Financial news and updates
💡 Investment strategies and education

Just mention fund types or investment topics to start a conversation!`;

    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    logger.info(`Help command executed in chat ${ctx.chat?.id}`);
  }

  /**
   * /search - Search for specific funds
   */
  async search(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) return;

      // Check rate limit
      if (!rateLimiter.checkLimit(userId, 'search')) {
        const message = rateLimiter.getRateLimitMessage(userId, 'search');
        await ctx.reply(message);
        SecurityLogger.logRateLimitViolation('search', userId, ctx.from?.username, ctx.chat?.id);
        return;
      }

      const messageText = (ctx.message as any)?.text || '';
      const parts = messageText.split(' ');
      const query = parts.slice(1).join(' ');

      if (!query) {
        await ctx.reply('Please provide a search term. Example: `/search Stanbic` or `/search money market`', { parse_mode: 'Markdown' });
        return;
      }

      // Validate and sanitize query
      const validation = InputValidator.validateSearchQuery(query);
      if (!validation.valid) {
        await ctx.reply(`❌ ${validation.error}`);
        SecurityLogger.logValidationFailure('search_query', validation.error || 'Unknown', userId, ctx.from?.username);
        return;
      }

      const sanitizedQuery = validation.sanitized;
      await ctx.reply(`🔍 Searching for "${sanitizedQuery}"...`);
      const funds = await marketDataService.searchFund(sanitizedQuery);

      if (funds.length === 0) {
        await ctx.reply(`No funds found matching "${sanitizedQuery}". Try a different search term.`);
        return;
      }

      // Group funds by provider for better organization
      const byProvider: Record<string, typeof funds> = {};
      funds.forEach(fund => {
        if (!byProvider[fund.fundManager]) {
          byProvider[fund.fundManager] = [];
        }
        byProvider[fund.fundManager].push(fund);
      });

      let response = `🔍 *Search Results for "${query}"*\n\n`;
      response += `Found ${funds.length} fund(s) from ${Object.keys(byProvider).length} provider(s):\n\n`;

      // Show all funds grouped by provider
      Object.entries(byProvider).forEach(([provider, providerFunds]) => {
        response += `*${provider}* (${providerFunds.length} fund${providerFunds.length > 1 ? 's' : ''})\n`;

        providerFunds.forEach((fund) => {
          const fundTypeFormatted = fund.type.replace('_', ' ').toUpperCase();

          response += `\n📊 *${fund.name}*\n`;
          response += `   Type: ${fundTypeFormatted}\n`;
          if (fund.yieldToDate) {
            response += `   Yield: ${fund.yieldToDate}\n`;
          }
          if (fund.minimumInvestment) {
            response += `   Min. Investment: ${fund.minimumInvestment}\n`;
          }
          if (fund.riskProfile) {
            response += `   Risk: ${fund.riskProfile}\n`;
          }
          // Add link to product detail page (or category page as fallback)
          const linkUrl = fund.url || fund.categoryUrl;
          if (linkUrl) {
            response += `   [View Details on NairaCompare ↗](${linkUrl})\n`;
          }
        });
        response += '\n';
      });

      await ctx.reply(response, { parse_mode: 'Markdown' });
      logger.info(`Search command executed in chat ${ctx.chat?.id} for query: ${query}`);
    } catch (error) {
      errorMonitor.trackError('command_search', error as Error, { chatId: ctx.chat?.id, userId: ctx.from?.id });
      await ctx.reply('❌ Sorry, I couldn\'t search for funds right now. Please try again later.');
    }
  }

  /**
   * /funds - View mutual fund performance
   */
  async funds(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) return;

      // Check rate limit
      if (!rateLimiter.checkLimit(userId, 'funds')) {
        const message = rateLimiter.getRateLimitMessage(userId, 'funds');
        await ctx.reply(message);
        SecurityLogger.logRateLimitViolation('funds', userId, ctx.from?.username, ctx.chat?.id);
        return;
      }

      // Extract fund type from command if provided
      const messageText = (ctx.message as any)?.text || '';
      const parts = messageText.split(' ');
      const fundTypeRaw = parts.length > 1 ? parts[1] : undefined;

      // If no fund type specified, show selection menu
      if (!fundTypeRaw) {
        const menuMessage = `💰 *Nigerian Mutual Funds*\n\n` +
          `Please select the type of mutual fund you're interested in:\n\n` +
          `📊 *Available Fund Types:*\n\n` +
          `💵 *Money Market Funds*\n` +
          `   Low-risk, short-term investments\n` +
          `   Command: \`/funds money_market\`\n\n` +
          `📈 *Fixed Income Funds*\n` +
          `   Stable returns through bonds\n` +
          `   Command: \`/funds fixed_income\`\n\n` +
          `💸 *Dollar Funds*\n` +
          `   USD-denominated investments\n` +
          `   Command: \`/funds dollar\`\n\n` +
          `⚖️ *Balanced Funds*\n` +
          `   Mix of stocks and bonds\n` +
          `   Command: \`/funds balance\`\n\n` +
          `📊 *Equity Funds*\n` +
          `   Stock market investments\n` +
          `   Command: \`/funds equity\`\n\n` +
          `_Type your command to see available funds in each category_`;

        await ctx.reply(menuMessage, { parse_mode: 'Markdown' });
        return;
      }

      // Validate fund type
      const fundTypeValidation = InputValidator.validateFundType(fundTypeRaw);
      if (!fundTypeValidation.valid) {
        await ctx.reply(`❌ ${fundTypeValidation.error}`);
        SecurityLogger.logValidationFailure('fund_type', fundTypeValidation.error || 'Unknown', userId, ctx.from?.username);
        return;
      }

      const fundType = fundTypeValidation.sanitized;

      await ctx.reply('💰 Fetching fund data...');

      const allFunds = await marketDataService.getFundData();
      const funds = allFunds.filter(f => f.type === fundType);

      if (funds.length === 0) {
        await ctx.reply('No funds found for this category.');
        return;
      }

      // Show only top 5 funds
      const topFunds = funds.slice(0, 5);
      let response = `💰 *Top ${fundType.replace('_', ' ').toUpperCase()} Funds*\n\n`;

      topFunds.forEach((fund, index) => {
        const fundNumber = index + 1;

        response += `${fundNumber}. *${fund.name}*\n`;
        response += `   🏢 Provider: ${fund.fundManager}\n`;
        if (fund.yieldToDate) {
          response += `   📊 Yield: ${fund.yieldToDate}\n`;
        }
        if (fund.minimumInvestment) {
          response += `   💰 Min. Investment: ${fund.minimumInvestment}\n`;
        }
        if (fund.riskProfile) {
          response += `   ⚠️ Risk: ${fund.riskProfile}\n`;
        }
        // Add link to the fund if available
        if (fund.url) {
          response += `   🔗 [View Details](${fund.url})\n`;
        }
        response += '\n';
      });

      response += `_Showing top 5 of ${funds.length} ${fundType.replace('_', ' ')} fund(s)_\n`;
      response += `_Data updated: ${new Date().toLocaleString('en-NG')}_\n\n`;

      // Map fund types to NairaCompare URLs
      const nairaCompareUrls: Record<string, string> = {
        money_market: 'https://nairacompare.ng/investments/money-market-fund-compare',
        fixed_income: 'https://nairacompare.ng/investments/fixed-income-fund-compare',
        dollar: 'https://nairacompare.ng/investments/dollar-fund-compare',
        balance: 'https://nairacompare.ng/investments/balanced-fund-compare',
        equity: 'https://nairacompare.ng/investments/equity-fund-compare',
      };

      const seeMoreUrl = nairaCompareUrls[fundType];

      // Create inline keyboard with "See More Options" button
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '📋 See More Options',
              url: seeMoreUrl,
            },
          ],
          [
            {
              text: '🔙 Back to Fund Types',
              callback_data: 'back_to_funds',
            },
          ],
        ],
      };

      await ctx.reply(response, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });

      logger.info(`Funds command executed in chat ${ctx.chat?.id} with type: ${fundType}`);
    } catch (error) {
      errorMonitor.trackError('command_funds', error as Error, { chatId: ctx.chat?.id, userId: ctx.from?.id });
      await ctx.reply('❌ Sorry, I couldn\'t fetch fund data right now. Please try again later.');
    }
  }

  /**
   * /news - Get latest financial news
   */
  async news(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      if (!userId) return;

      // Check rate limit
      if (!rateLimiter.checkLimit(userId, 'news')) {
        const message = rateLimiter.getRateLimitMessage(userId, 'news');
        await ctx.reply(message);
        SecurityLogger.logRateLimitViolation('news', userId, ctx.from?.username, ctx.chat?.id);
        return;
      }

      await ctx.reply('📰 Fetching latest financial news...');
      const newsItems = await marketDataService.getFinancialNews(5);

      if (newsItems.length === 0) {
        await ctx.reply('No recent news available at the moment.');
        return;
      }

      let response = '📰 *Latest Nigerian Financial News*\n\n';

      newsItems.forEach((item, index) => {
        const categoryEmoji: Record<string, string> = {
          market: '📈',
          funds: '💰',
          economy: '🏦',
          policy: '📋',
          stocks: '📊',
          tech: '💻',
        };
        const emoji = categoryEmoji[item.category] || '📰';

        response += `${emoji} *${item.title}*\n`;
        response += `${item.summary}\n`;
        response += `_Source: ${item.source} | ${item.publishedAt.toLocaleDateString('en-NG')}_\n`;
        if (item.url) {
          response += `[Read more](${item.url})\n`;
        }
        response += '\n';
      });

      await ctx.reply(response, { parse_mode: 'Markdown' });
      logger.info(`News command executed in chat ${ctx.chat?.id}`);
    } catch (error) {
      errorMonitor.trackError('command_news', error as Error, { chatId: ctx.chat?.id, userId: ctx.from?.id });
      await ctx.reply('❌ Sorry, I couldn\'t fetch news right now. Please try again later.');
    }
  }

  /**
   * /about - About the bot
   */
  async about(ctx: Context): Promise<void> {
    const aboutMessage = `ℹ️ *About Nigerian Investment Bot*

I'm an AI-powered Telegram bot designed to keep Nigerian investors informed and engaged about mutual funds and investments.

*Features:*
• Daily mutual fund performance tracking
• Comprehensive fund database from NairaCompare
• Financial news aggregation
• Intelligent Q&A about investments
• Automated fund performance alerts
• Search and compare funds

*Data Sources:*
I scrape data daily from NairaCompare.ng to bring you accurate information about Nigerian mutual funds including Money Market, Fixed Income, Dollar, Balanced, and Equity funds from top fund managers.

*Covered Fund Managers:*
Stanbic IBTC, ARM, Coronation, FCMB, Vetiva, FBNQuest, Meristem, and many more!

*Disclaimer:*
This bot provides educational information and market data for informational purposes only. It does not constitute financial advice. Always consult with a qualified financial advisor before making investment decisions.

*Developer:*
Built with ❤️ for Nigerian investors

For support or feedback, contact the bot administrator.`;

    await ctx.reply(aboutMessage, { parse_mode: 'Markdown' });
    logger.info(`About command executed in chat ${ctx.chat?.id}`);
  }

  /**
   * /clear - Clear conversation context (for fresh start)
   */
  async clear(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    if (chatId) {
      aiService.clearContext(chatId);
      await ctx.reply('🔄 Conversation history cleared. Starting fresh!');
      logger.info(`Clear command executed in chat ${chatId}`);
    }
  }

  /**
   * /refresh - Manually trigger data refresh (Admin only)
   */
  async refresh(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const chatId = ctx.chat?.id;
      const username = ctx.from?.username || 'unknown';

      if (!userId) {
        logger.error('Refresh command called without valid user ID');
        return;
      }

      // Validate user ID
      const userValidation = InputValidator.validateUserId(userId);
      if (!userValidation.valid) {
        logger.error(`Invalid user ID in refresh command: ${userValidation.error}`);
        return;
      }

      // Check if user is admin with detailed logging
      if (!config.adminIds.includes(userId)) {
        await ctx.reply('⛔ This command is only available to administrators.');
        SecurityLogger.logUnauthorizedAccess('/refresh command', userId, username, chatId);
        return;
      }

      // Check rate limit (1 per 10 minutes, even for admins)
      if (!rateLimiter.checkLimit(userId, 'refresh')) {
        const message = rateLimiter.getRateLimitMessage(userId, 'refresh');
        await ctx.reply(message);
        SecurityLogger.logRateLimitViolation('refresh', userId, username, chatId);
        return;
      }

      await ctx.reply('🔄 Starting fund data refresh... This may take a few minutes.');
      SecurityLogger.logAdminAction('Data refresh', userId, username, chatId);

      const freshFunds = await scraperService.scrapeFunds();

      await ctx.reply(`✅ *Data Refresh Complete!*\n\n` +
        `Successfully scraped ${freshFunds.length} funds from NairaCompare.\n\n` +
        `The latest fund data is now available. Use /funds to view!`,
        { parse_mode: 'Markdown' });

      logger.info(
        `ADMIN ACTION: Refresh completed by admin ${userId} (${username}) - ${freshFunds.length} funds scraped`
      );
    } catch (error) {
      const errorContext = { userId: ctx.from?.id, username: ctx.from?.username, chatId: ctx.chat?.id };
      errorMonitor.trackError('command_refresh', error as Error, errorContext);
      await ctx.reply('❌ Failed to refresh data. Please check logs or try again later.');
    }
  }

  /**
   * /health - System health check
   */
  async health(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username;

      if (!userId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Admin-only command
      if (!config.adminIds.includes(userId)) {
        logger.warn(`Unauthorized health check attempt by user ${userId} (${username || 'unknown'})`);
        SecurityLogger.logEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'medium',
          description: `User ${userId} (${username || 'unknown'}) attempted to access health check`,
          userId: userId,
          metadata: { command: 'health', username },
        });
        await ctx.reply('⛔ This command is only available to administrators.');
        return;
      }

      await ctx.reply('🔍 Running health checks...');

      // Run health checks
      const healthResult = await healthCheck.runHealthChecks();

      // Generate and send report
      const healthReport = healthCheck.generateHealthReport(healthResult);
      const serviceReport = serviceHealthMonitor.generateHealthReport();

      const fullReport = `${healthReport}\n\n${serviceReport}`;
      await ctx.reply(fullReport, { parse_mode: 'Markdown' });

      logger.info(`Health check requested by admin ${userId} (${username || 'unknown'})`);
    } catch (error) {
      const errorContext = { userId: ctx.from?.id, username: ctx.from?.username, chatId: ctx.chat?.id };
      errorMonitor.trackError('command_health', error as Error, errorContext);
      await ctx.reply('❌ Failed to run health check. Please check logs.');
    }
  }

  /**
   * /stats - Usage analytics
   */
  async stats(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username;

      if (!userId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Admin-only command
      if (!config.adminIds.includes(userId)) {
        logger.warn(`Unauthorized stats access attempt by user ${userId} (${username || 'unknown'})`);
        SecurityLogger.logEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'medium',
          description: `User ${userId} (${username || 'unknown'}) attempted to access usage stats`,
          userId: userId,
          metadata: { command: 'stats', username },
        });
        await ctx.reply('⛔ This command is only available to administrators.');
        return;
      }

      // Generate and send analytics report
      const report = usageAnalytics.generateReport(7);
      await ctx.reply(report, { parse_mode: 'Markdown' });

      logger.info(`Usage stats requested by admin ${userId} (${username || 'unknown'})`);
    } catch (error) {
      const errorContext = { userId: ctx.from?.id, username: ctx.from?.username, chatId: ctx.chat?.id };
      errorMonitor.trackError('command_stats', error as Error, errorContext);
      await ctx.reply('❌ Failed to generate usage stats. Please check logs.');
    }
  }

  /**
   * /backup - Manual backup trigger
   */
  async backup(ctx: Context): Promise<void> {
    try {
      const userId = ctx.from?.id;
      const username = ctx.from?.username;

      if (!userId) {
        await ctx.reply('❌ Unable to identify user.');
        return;
      }

      // Admin-only command
      if (!config.adminIds.includes(userId)) {
        logger.warn(`Unauthorized backup attempt by user ${userId} (${username || 'unknown'})`);
        SecurityLogger.logEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'medium',
          description: `User ${userId} (${username || 'unknown'}) attempted to trigger backup`,
          userId: userId,
          metadata: { command: 'backup', username },
        });
        await ctx.reply('⛔ This command is only available to administrators.');
        return;
      }

      await ctx.reply('💾 Starting backup...');

      // Perform backup
      const backupPath = await backupService.performBackup();
      const stats = backupService.getBackupStats();

      let report = `✅ *Backup Complete!*\n\n`;
      report += `📁 Total backups: ${stats.totalBackups}\n`;
      report += `💾 Total size: ${stats.totalSize}\n`;

      if (stats.newestBackup) {
        const backupTime = new Date(stats.newestBackup).toLocaleString();
        report += `🕐 Latest backup: ${backupTime}\n`;
      }

      await ctx.reply(report, { parse_mode: 'Markdown' });

      SecurityLogger.logAdminAction('Manual backup', userId, username, ctx.chat?.id);
      logger.info(`Manual backup completed by admin ${userId} (${username || 'unknown'})`);
    } catch (error) {
      const errorContext = { userId: ctx.from?.id, username: ctx.from?.username, chatId: ctx.chat?.id };
      errorMonitor.trackError('command_backup', error as Error, errorContext);
      await ctx.reply('❌ Failed to perform backup. Please check logs.');
    }
  }
}

export default new CommandHandlers();
 
