/**
 * Bot Configuration System
 *
 * This file defines the comprehensive configuration structure for the Telegram bot.
 * It includes message templates, feature flags, rate limits, and all customizable settings.
 *
 * Usage:
 * 1. Customize this file to match your bot's specific needs
 * 2. Message templates support markdown formatting
 * 3. All intervals are in minutes unless specified otherwise
 * 4. Enable/disable features using feature flags
 */

export interface BotMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  repository?: string;
}

export interface MessageTemplates {
  welcome: string;
  help: string;
  about: string;
  commandNotFound: string;
  error: string;
  unauthorized: string;
  rateLimitExceeded: string;
  userBlocked: string;
}

export interface CommandConfig {
  enabled: boolean;
  description: string;
  rateLimit?: number; // requests per minute
  adminOnly?: boolean;
}

export interface FeatureFlags {
  enableAI: boolean;
  enableDataScraping: boolean;
  enableNewsScraping: boolean;
  enableScheduledTasks: boolean;
  enableAdminCommands: boolean;
  enableUserBlocking: boolean;
  enableAnalytics: boolean;
  enableBackups: boolean;
  enableHealthChecks: boolean;
}

export interface RateLimitConfig {
  defaultLimit: number; // requests per minute
  commandLimits: {
    [command: string]: number;
  };
}

export interface CacheConfig {
  dataCacheTTL: number; // minutes
  newsCacheTTL: number; // minutes
  conversationTTL: number; // minutes
  maxConversationHistory: number; // messages
  maxConcurrentChats: number; // concurrent conversations
}

export interface ScheduleConfig {
  timezone: string; // e.g., 'Africa/Lagos', 'UTC'
  dailyDataRefresh: string; // cron format or time (e.g., '06:00')
  dailySummary: string; // cron format or time (e.g., '09:00')
  weeklyRoundup: string; // cron format or time (e.g., 'Fri 17:00')
  marketMonitoring: string; // cron format or time (e.g., '15:00')
  newsMonitoring: string; // interval in minutes or cron
}

export interface GroupBehaviorConfig {
  normalChatDelayMin: number; // seconds
  normalChatDelayMax: number; // seconds
  busyChatDelayMin: number; // seconds
  busyChatDelayMax: number; // seconds
  busyChatThreshold: number; // messages in recent history to consider "busy"
  responseTimeout: number; // seconds to wait for human response
  maxMessageLength: number; // characters before splitting
}

export interface SecurityConfig {
  maxSearchQueryLength: number;
  maxMessageLength: number;
  enableSecurityLogging: boolean;
  enableInputValidation: boolean;
}

export interface BotCustomConfig {
  metadata: BotMetadata;
  messages: MessageTemplates;
  commands: {
    [commandName: string]: CommandConfig;
  };
  features: FeatureFlags;
  rateLimits: RateLimitConfig;
  cache: CacheConfig;
  schedules: ScheduleConfig;
  groupBehavior: GroupBehaviorConfig;
  security: SecurityConfig;
}

/**
 * Default Bot Configuration
 *
 * This is a template configuration. Customize it for your specific bot.
 * You can override these values by creating a custom config file.
 */
export const defaultBotConfig: BotCustomConfig = {
  metadata: {
    name: 'Telegram Bot Template',
    version: '1.0.0',
    description: 'A customizable Telegram bot template with AI integration, scheduling, and more.',
    author: 'Edikan Udoibuot',
    repository: 'https://github.com/edikaniu/telegram-bot-template',
  },

  messages: {
    welcome: `👋 Welcome to the bot!

I'm here to help you. Use /help to see available commands.`,

    help: `📚 **Available Commands**

🔹 /start - Start the bot
🔹 /help - Show this help message
🔹 /about - About this bot

*For more information, visit our documentation.*`,

    about: `ℹ️ **About This Bot**

This bot is built using the Telegram Bot Template - a flexible, feature-rich foundation for creating Telegram bots.

**Features:**
• AI-powered conversations
• Scheduled tasks and automation
• Admin management system
• Rate limiting and security
• Analytics and monitoring

For more info, visit: [GitHub Repository](https://github.com/edikaniu/telegram-bot-template)`,

    commandNotFound: `❓ Command not found. Use /help to see available commands.`,

    error: `❌ An error occurred while processing your request. Please try again later.`,

    unauthorized: `🚫 You don't have permission to use this command.`,

    rateLimitExceeded: `⏱️ Rate limit exceeded. Please slow down and try again in a moment.`,

    userBlocked: `🚫 You have been blocked from using this bot.`,
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
      description: 'About this bot',
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
    defaultLimit: 5, // 5 requests per minute
    commandLimits: {
      search: 10,
      funds: 10,
      news: 10,
      refresh: 1, // 1 per 10 minutes (handled separately)
    },
  },

  cache: {
    dataCacheTTL: 30, // 30 minutes
    newsCacheTTL: 30, // 30 minutes
    conversationTTL: 15, // 15 minutes
    maxConversationHistory: 20, // 20 messages per chat
    maxConcurrentChats: 50, // 50 concurrent conversations
  },

  schedules: {
    timezone: 'UTC',
    dailyDataRefresh: '06:00', // 6 AM UTC
    dailySummary: '08:00', // 8 AM UTC
    weeklyRoundup: 'Fri 16:00', // Friday 4 PM UTC
    marketMonitoring: '15:00', // 3 PM UTC
    newsMonitoring: '*/6 * * * *', // Every 6 hours
  },

  groupBehavior: {
    normalChatDelayMin: 5, // 5 seconds
    normalChatDelayMax: 15, // 15 seconds
    busyChatDelayMin: 20, // 20 seconds
    busyChatDelayMax: 40, // 40 seconds
    busyChatThreshold: 5, // 5+ messages = busy
    responseTimeout: 120, // 2 minutes
    maxMessageLength: 800, // Split messages longer than 800 chars
  },

  security: {
    maxSearchQueryLength: 100,
    maxMessageLength: 4000,
    enableSecurityLogging: true,
    enableInputValidation: true,
  },
};

/**
 * Load custom bot configuration
 *
 * You can override the default configuration by providing a custom config object.
 * This is useful for creating different bot instances with different settings.
 *
 * @param customConfig - Partial custom configuration to merge with defaults
 * @returns Complete bot configuration
 */
export function loadBotConfig(customConfig?: Partial<BotCustomConfig>): BotCustomConfig {
  if (!customConfig) {
    return defaultBotConfig;
  }

  return {
    metadata: { ...defaultBotConfig.metadata, ...customConfig.metadata },
    messages: { ...defaultBotConfig.messages, ...customConfig.messages },
    commands: { ...defaultBotConfig.commands, ...customConfig.commands },
    features: { ...defaultBotConfig.features, ...customConfig.features },
    rateLimits: {
      ...defaultBotConfig.rateLimits,
      ...customConfig.rateLimits,
      commandLimits: {
        ...defaultBotConfig.rateLimits.commandLimits,
        ...customConfig.rateLimits?.commandLimits,
      },
    },
    cache: { ...defaultBotConfig.cache, ...customConfig.cache },
    schedules: { ...defaultBotConfig.schedules, ...customConfig.schedules },
    groupBehavior: { ...defaultBotConfig.groupBehavior, ...customConfig.groupBehavior },
    security: { ...defaultBotConfig.security, ...customConfig.security },
  };
}

export default defaultBotConfig;
