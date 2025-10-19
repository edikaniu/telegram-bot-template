# Quick Start Guide - Using This Template

This guide will help you get started with creating your own Telegram bot using this template in just a few minutes!

## Overview

This template provides:
- ✅ Complete bot structure ready to customize
- ✅ AI integration (Claude, with OpenAI support coming)
- ✅ Admin system with role-based permissions
- ✅ Scheduling and automation
- ✅ Rate limiting and security
- ✅ Analytics and monitoring
- ✅ Clean, maintainable code structure

## 5-Minute Quick Start

### Step 1: Get Your Bot Token

1. Open Telegram and find [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Choose a name for your bot (e.g., "My Awesome Bot")
4. Choose a username (must end with `bot`, e.g., "myawesomebot")
5. Copy the API token provided (looks like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Step 2: Get Your User ID

1. Open Telegram and find [@userinfobot](https://t.me/userinfobot)
2. Send any message to it
3. Copy your user ID (a number like `123456789`)

### Step 3: Clone and Setup

```bash
# Clone this template
git clone https://github.com/edikaniu/telegram-bot-template.git my-telegram-bot
cd my-telegram-bot

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Step 4: Configure Your Bot

Edit `.env` file and add your credentials:

```env
# REQUIRED
TELEGRAM_BOT_TOKEN=paste_your_bot_token_here
BOT_ADMIN_IDS=paste_your_user_id_here

# OPTIONAL (but recommended for AI features)
ANTHROPIC_API_KEY=your_claude_api_key
```

### Step 5: Customize Your Bot

Edit `src/config/botConfig.ts` to customize:

```typescript
export const defaultBotConfig: BotCustomConfig = {
  metadata: {
    name: 'My Awesome Bot',           // Your bot name
    version: '1.0.0',
    description: 'What your bot does',
  },

  messages: {
    welcome: `👋 Welcome to My Awesome Bot!

I can help you with...`,                  // Customize welcome message

    help: `Available commands:
/start - Start the bot
/help - Show this message`,               // Customize help message
  },

  // Enable/disable features
  features: {
    enableAI: true,                       // AI conversations
    enableDataScraping: false,            // Web scraping
    enableScheduledTasks: false,          // Automated tasks
  },
};
```

### Step 6: Run Your Bot

```bash
# Development mode (auto-reload on changes)
npm run dev
```

Your bot is now running! Open Telegram and send `/start` to your bot.

## What's Next?

### Level 1: Customize Messages

Edit `src/config/botConfig.ts` to change:
- Welcome message
- Help text
- About information
- Command descriptions

### Level 2: Add Custom Commands

1. **Define command in `botConfig.ts`**:
   ```typescript
   commands: {
     mycommand: {
       enabled: true,
       description: 'My custom command',
       rateLimit: 5,
       adminOnly: false,
     },
   }
   ```

2. **Implement handler in `src/handlers/commands.ts`**:
   ```typescript
   export function registerCommands(bot: Telegraf) {
     bot.command('mycommand', async (ctx) => {
       await ctx.reply('Hello from my custom command!');
     });
   }
   ```

### Level 3: Add Data Sources

1. **Create a data provider** (see `src/interfaces/IDataProvider.ts`):
   ```typescript
   import { BaseDataProvider, DataItem } from '../interfaces/IDataProvider';

   interface MyData extends DataItem {
     // Your custom fields
     value: string;
   }

   export class MyDataProvider extends BaseDataProvider<MyData> {
     async fetchAll(): Promise<MyData[]> {
       // Fetch from API, database, or web scraping
       const response = await fetch('https://api.example.com/data');
       const data = await response.json();
       this.updateCache(data);
       return data;
     }

     async fetchByType(type: string): Promise<MyData[]> {
       const all = await this.fetchAll();
       return all.filter(item => item.type === type);
     }

     async healthCheck() {
       return { healthy: true };
     }
   }
   ```

2. **Use in your command**:
   ```typescript
   const dataProvider = new MyDataProvider('My Data', 30);

   bot.command('data', async (ctx) => {
     const data = await dataProvider.fetchAll();
     ctx.reply(`Found ${data.length} items`);
   });
   ```

### Level 4: Enable AI Features

1. **Get Anthropic API key**: https://console.anthropic.com/
2. **Add to `.env`**:
   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
   ```
3. **Enable in `botConfig.ts`**:
   ```typescript
   features: {
     enableAI: true,
   }
   ```

Now your bot will have intelligent conversations!

### Level 5: Add Scheduled Tasks

Edit `src/services/scheduler.ts`:

```typescript
import cron from 'node-cron';

export class Scheduler {
  startDailyTask(): void {
    // Runs every day at 9 AM
    cron.schedule('0 9 * * *', async () => {
      console.log('Running daily task...');
      // Your task here
    });
  }

  startHourlyTask(): void {
    // Runs every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Running hourly task...');
      // Your task here
    });
  }
}
```

Enable in `src/index.ts`:

```typescript
if (botConfig.features.enableScheduledTasks) {
  this.scheduler.startDailyTask();
  this.scheduler.startHourlyTask();
}
```

## Common Customizations

### Change Bot Personality (AI)

Edit `src/services/aiService.ts`:

```typescript
const systemPrompt = `You are a helpful assistant for [YOUR USE CASE].
You should be [PERSONALITY TRAITS: friendly, professional, funny, etc.].
Your main goal is to [PRIMARY FUNCTION].`;
```

### Add Custom Rate Limits

Edit `src/config/botConfig.ts`:

```typescript
rateLimits: {
  defaultLimit: 5,              // 5 requests per minute by default
  commandLimits: {
    search: 10,                 // 10 searches per minute
    premium: 50,                // Higher limit for premium command
  },
}
```

### Customize Group Behavior

Edit `src/config/botConfig.ts`:

```typescript
groupBehavior: {
  normalChatDelayMin: 2,        // Wait 2-5 seconds before responding
  normalChatDelayMax: 5,
  busyChatDelayMin: 10,         // Wait 10-20 seconds in busy chats
  busyChatDelayMax: 20,
  responseTimeout: 60,          // Don't respond if someone answered within 60s
}
```

## Deployment

### Railway.app (Easiest)

1. Create account: https://railway.app
2. Create new project from GitHub
3. Add environment variables in dashboard:
   - `TELEGRAM_BOT_TOKEN`
   - `BOT_ADMIN_IDS`
   - `ANTHROPIC_API_KEY` (if using AI)
4. Deploy!

### Heroku

```bash
heroku create my-telegram-bot
heroku config:set TELEGRAM_BOT_TOKEN=your_token
heroku config:set BOT_ADMIN_IDS=your_id
heroku config:set ANTHROPIC_API_KEY=your_key
git push heroku main
```

### VPS

```bash
# On your server
git clone your-repo
cd your-repo
npm install
npm run build

# Set up environment
cp .env.example .env
nano .env  # Add your credentials

# Run with PM2
npm install -g pm2
pm2 start dist/index.js --name my-bot
pm2 save
pm2 startup
```

## Examples

### Simple Echo Bot

See [`examples/simple-echo-bot/`](examples/simple-echo-bot/) for a minimal example with just basic commands and message echoing.

### Nigerian Investment Bot

See [`examples/nigerian-investment-bot/`](examples/nigerian-investment-bot/) for a complete, production-ready example with:
- Web scraping
- AI integration
- Scheduled tasks
- News aggregation
- Admin system

## Troubleshooting

### Bot doesn't start

```bash
# Check Node.js version (must be >= 20.18.0)
node --version

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for errors
npm run build
```

### Bot doesn't respond

1. ✅ Verify `TELEGRAM_BOT_TOKEN` is correct in `.env`
2. ✅ Check bot is running: should see "Bot is running!" message
3. ✅ Send `/start` to your bot in Telegram
4. ✅ Check logs for errors

### AI doesn't work

1. ✅ Verify `ANTHROPIC_API_KEY` in `.env`
2. ✅ Check API key is valid: https://console.anthropic.com/
3. ✅ Enable AI in `botConfig.ts`: `enableAI: true`
4. ✅ Check you have API credits

### Rate limit errors

- Reduce rate limits in `botConfig.ts`
- Add delays between API calls
- Use caching to reduce requests

## Getting Help

- 📖 **Documentation**: Read [`README.md`](README.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md)
- 💬 **Discussions**: Use GitHub Discussions for questions
- 🐛 **Bugs**: Open an issue on GitHub
- 📧 **Community**: Join our Discord (if available)

## Next Steps

1. ✅ Complete this quick start
2. 📖 Read the [full README](README.md)
3. 🏗️ Study the [architecture docs](ARCHITECTURE.md)
4. 🎨 Review the [customization guide](CUSTOMIZATION.md)
5. 🚀 Check the [deployment guide](DEPLOYMENT.md)
6. 👀 Explore the [examples](examples/)

## Resources

- [Telegraf Documentation](https://telegraf.js.org/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Anthropic Claude Docs](https://docs.anthropic.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Ready to build something awesome? Let's go! 🚀**
