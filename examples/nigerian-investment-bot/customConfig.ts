/**
 * Nigerian Investment Bot - Custom Configuration
 *
 * This file demonstrates how to customize the bot template for a specific use case.
 * It extends the default configuration with domain-specific settings for a
 * Nigerian investment information bot.
 */

import { BotCustomConfig } from '../../src/config/botConfig';

/**
 * Custom configuration for Nigerian Investment Bot
 */
export const nigerianInvestmentConfig: Partial<BotCustomConfig> = {
  metadata: {
    name: 'NairaSense Investment Bot',
    version: '1.0.0',
    description: 'A Telegram bot for keeping Nigerian investors informed about mutual funds, financial news, and market analysis.',
    author: 'Edikan Udoibuot',
    repository: 'https://github.com/edikaniu/telegram-bot-template',
  },

  messages: {
    welcome: `👋 Welcome to NairaSense!

I'm your Nigerian investment information assistant. I keep you updated on:

📊 Mutual fund performance across Nigerian fund managers
📰 Latest financial news from trusted sources
💹 Market trends and analysis
🔔 Real-time alerts for high-performing funds

Use /help to see all available commands.`,

    help: `📚 **Available Commands**

**Investment Data:**
🔹 /funds [type] - View mutual funds by type
   • Types: money_market, fixed_income, dollar, balance, equity
   • Example: \`/funds money_market\`

🔹 /search [query] - Search for specific funds
   • Example: \`/search stanbic\`

**News & Updates:**
🔹 /news - Get latest Nigerian financial news

**General:**
🔹 /start - Start the bot
🔹 /help - Show this help message
🔹 /about - About NairaSense
🔹 /clear - Clear conversation history

**Admin Commands:**
🔹 /health - System health check
🔹 /stats - Usage statistics
🔹 /refresh - Force data refresh
🔹 /backup - Manual backup

*You can also just chat with me naturally - I'm powered by AI! 🤖*`,

    about: `ℹ️ **About NairaSense**

NairaSense is your intelligent assistant for Nigerian investment information.

**Key Features:**
• Real-time mutual fund data from NairaCompare
• Financial news aggregation from top Nigerian sources
• AI-powered conversational assistance
• Automated alerts for high-yield opportunities
• Daily summaries and weekly roundups

**Data Sources:**
• Mutual Funds: NairaCompare.ng
• News: Punch, Vanguard, ThisDay

**Disclaimer:**
This bot provides information only. Always consult a licensed financial advisor before making investment decisions.

Built with the Telegram Bot Template
GitHub: https://github.com/yourusername/telegram-bot-template`,

    commandNotFound: `❓ Command not found. Use /help to see available commands.

💡 Tip: You can also chat with me naturally!`,

    error: `❌ An error occurred while processing your request.

This might be temporary - please try again in a moment. If the issue persists, contact an admin.`,

    unauthorized: `🚫 This command requires admin privileges.`,

    rateLimitExceeded: `⏱️ Whoa, slow down! You're making requests too quickly.

Please wait a moment before trying again.`,

    userBlocked: `🚫 You have been blocked from using this bot.

If you believe this is a mistake, please contact an admin.`,
  },

  commands: {
    start: {
      enabled: true,
      description: 'Start the bot',
      adminOnly: false,
    },
    help: {
      enabled: true,
      description: 'Show help message',
      adminOnly: false,
    },
    about: {
      enabled: true,
      description: 'About NairaSense',
      adminOnly: false,
    },
    funds: {
      enabled: true,
      description: 'View mutual funds by type',
      rateLimit: 10,
      adminOnly: false,
    },
    search: {
      enabled: true,
      description: 'Search for funds',
      rateLimit: 10,
      adminOnly: false,
    },
    news: {
      enabled: true,
      description: 'Latest financial news',
      rateLimit: 10,
      adminOnly: false,
    },
    clear: {
      enabled: true,
      description: 'Clear conversation history',
      adminOnly: false,
    },
    // Admin commands
    health: {
      enabled: true,
      description: 'System health check',
      adminOnly: true,
    },
    stats: {
      enabled: true,
      description: 'Usage statistics',
      adminOnly: true,
    },
    refresh: {
      enabled: true,
      description: 'Force data refresh',
      adminOnly: true,
      rateLimit: 1, // 1 per 10 minutes
    },
    backup: {
      enabled: true,
      description: 'Trigger manual backup',
      adminOnly: true,
    },
    block: {
      enabled: true,
      description: 'Block a user',
      adminOnly: true,
    },
    unblock: {
      enabled: true,
      description: 'Unblock a user',
      adminOnly: true,
    },
    blocklist: {
      enabled: true,
      description: 'View blocked users',
      adminOnly: true,
    },
    admins: {
      enabled: true,
      description: 'List all admins',
      adminOnly: true,
    },
    mypermissions: {
      enabled: true,
      description: 'View your permissions',
      adminOnly: true,
    },
    addadmin: {
      enabled: true,
      description: 'Add admin (Super Admin only)',
      adminOnly: true,
    },
    removeadmin: {
      enabled: true,
      description: 'Remove admin (Super Admin only)',
      adminOnly: true,
    },
  },

  features: {
    enableAI: true,
    enableDataScraping: true,
    enableNewsScraping: true,
    enableScheduledTasks: true,
    enableAdminCommands: true,
    enableUserBlocking: true,
    enableAnalytics: true,
    enableBackups: true,
    enableHealthChecks: true,
  },

  rateLimits: {
    defaultLimit: 5,
    commandLimits: {
      search: 10,
      funds: 10,
      news: 10,
      refresh: 1,
    },
  },

  cache: {
    dataCacheTTL: 30, // 30 minutes
    newsCacheTTL: 30, // 30 minutes
    conversationTTL: 15, // 15 minutes
    maxConversationHistory: 20,
    maxConcurrentChats: 50,
  },

  schedules: {
    timezone: 'Africa/Lagos', // Nigerian timezone (UTC+1)
    dailyDataRefresh: '06:00', // 6 AM Nigerian time
    dailySummary: '09:00', // 9 AM Nigerian time
    weeklyRoundup: 'Fri 17:00', // Friday 5 PM Nigerian time
    marketMonitoring: '15:00', // 3 PM Nigerian time
    newsMonitoring: '*/6 * * * *', // Every 6 hours
  },

  groupBehavior: {
    normalChatDelayMin: 5,
    normalChatDelayMax: 15,
    busyChatDelayMin: 20,
    busyChatDelayMax: 40,
    busyChatThreshold: 5,
    responseTimeout: 120,
    maxMessageLength: 800,
  },

  security: {
    maxSearchQueryLength: 100,
    maxMessageLength: 4000,
    enableSecurityLogging: true,
    enableInputValidation: true,
  },
};

export default nigerianInvestmentConfig;
