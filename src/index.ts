import { Telegraf } from 'telegraf';
import config from './config';
import commandHandlers from './handlers/commands';
import messageHandlers from './handlers/messages';
import blockCommands from './handlers/blockCommands';
import adminCommands from './handlers/adminCommands';
import { SchedulerService } from './services/scheduler';
import { Logger } from './utils/logger';
import SecurityLogger from './utils/securityLogger';
import usageAnalytics from './utils/usageAnalytics';
import backupService from './utils/backupService';

const logger = new Logger('Main');

class NigerianInvestmentBot {
  private bot: Telegraf;
  private scheduler: SchedulerService;

  constructor() {
    this.bot = new Telegraf(config.telegramToken);
    this.scheduler = new SchedulerService(this.bot);
  }

  /**
   * Initialize bot with all handlers and middleware
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Nigerian Investment Bot...');

    // Initialize security logger
    SecurityLogger.initialize();
    logger.info('Security logger initialized');

    // Initialize backup service
    backupService.initialize();
    logger.info('Backup service initialized');

    // Get bot info
    const botInfo = await this.bot.telegram.getMe();
    messageHandlers.setBotUsername(botInfo.username);
    logger.info(`Bot username: @${botInfo.username}`);

    // Add analytics middleware for commands
    this.bot.use(async (ctx, next) => {
      if (ctx.message && 'text' in ctx.message && ctx.message.text?.startsWith('/')) {
        const command = ctx.message.text.split(' ')[0].substring(1).split('@')[0];
        const userId = ctx.from?.id;
        const username = ctx.from?.username;

        if (userId) {
          usageAnalytics.trackCommand(command, userId, username);
        }
      }
      return next();
    });

    // Register command handlers
    this.bot.command('start', (ctx) => commandHandlers.start(ctx));
    this.bot.command('help', (ctx) => commandHandlers.help(ctx));
    this.bot.command('funds', (ctx) => commandHandlers.funds(ctx));
    this.bot.command('search', (ctx) => commandHandlers.search(ctx));
    this.bot.command('news', (ctx) => commandHandlers.news(ctx));
    this.bot.command('about', (ctx) => commandHandlers.about(ctx));
    this.bot.command('clear', (ctx) => commandHandlers.clear(ctx));
    this.bot.command('block', (ctx) => blockCommands.block(ctx));
    this.bot.command('unblock', (ctx) => blockCommands.unblock(ctx));
    this.bot.command('blocklist', (ctx) => blockCommands.blocklist(ctx));
    this.bot.command('refresh', (ctx) => commandHandlers.refresh(ctx));
    this.bot.command('health', (ctx) => commandHandlers.health(ctx));
    this.bot.command('stats', (ctx) => commandHandlers.stats(ctx));
    this.bot.command('backup', (ctx) => commandHandlers.backup(ctx));
    this.bot.command('admins', (ctx) => adminCommands.listAdmins(ctx));
    this.bot.command('mypermissions', (ctx) => adminCommands.myPermissions(ctx));
    this.bot.command('addadmin', (ctx) => adminCommands.addAdmin(ctx));
    this.bot.command('removeadmin', (ctx) => adminCommands.removeAdmin(ctx));

    // Register callback query handler
    this.bot.on('callback_query', async (ctx) => {
      const callbackData = (ctx.callbackQuery as any).data;

      if (callbackData === 'back_to_funds') {
        // Show the fund type selection menu
        await commandHandlers.funds(ctx);
        await ctx.answerCbQuery();
      }
    });

    // Register message handlers
    this.bot.on('text', (ctx) => messageHandlers.handleText(ctx));
    this.bot.on('new_chat_members', (ctx) => messageHandlers.handleNewChatMembers(ctx));
    this.bot.on('group_chat_created', (ctx) => messageHandlers.handleGroupUpdate(ctx));

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error(`Error for ${ctx.updateType}:`, err);
    });

    logger.info('Bot handlers registered successfully');
  }

  /**
   * Start the bot and scheduler
   */
  async start(): Promise<void> {
    try {
      await this.initialize();

      // Set up target groups for automated messages
      if (config.allowedGroupIds && config.allowedGroupIds.length > 0) {
        this.scheduler.setTargetGroups(config.allowedGroupIds);
      }

      // Start scheduled tasks
      this.scheduler.start();

      // Start daily summaries (enabled)
      // Railway uses UTC, Nigeria is UTC+1 (WAT), so 8 AM UTC = 9 AM WAT
      this.scheduler.startDailySummary(8, 0); // 9:00 AM Nigerian time (8:00 UTC)
      this.scheduler.startWeeklyRoundup(5, 16, 0); // Friday 5:00 PM Nigerian time (16:00 UTC)

      // Start bot polling
      await this.bot.launch();

      logger.info('✅ Nigerian Investment Bot is running!');
      logger.info('Press Ctrl+C to stop');

      // Enable graceful shutdown
      process.once('SIGINT', () => this.shutdown('SIGINT'));
      process.once('SIGTERM', () => this.shutdown('SIGTERM'));
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  /**
   * Gracefully shutdown the bot
   */
  private async shutdown(signal: string): Promise<void> {
    logger.info(`${signal} received. Shutting down gracefully...`);

    // Stop scheduler
    this.scheduler.stop();

    // Stop bot
    this.bot.stop(signal);

    logger.info('Bot stopped successfully');
    process.exit(0);
  }
}

// Start the bot
const bot = new NigerianInvestmentBot();
bot.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
