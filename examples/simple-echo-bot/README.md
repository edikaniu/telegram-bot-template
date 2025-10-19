# Simple Echo Bot Example

This is a minimal example demonstrating the core concepts of the Telegram Bot Template without additional complexity. Perfect for learning the basics!

## What This Example Shows

- Basic bot setup with minimal configuration
- Simple command handling (`/start`, `/help`, `/echo`)
- Message echoing functionality
- No external services (no AI, no scraping, no database)
- Clean code structure

## Features

- **Echo Command**: `/echo [message]` - Bot repeats your message
- **Start Command**: `/start` - Welcome message
- **Help Command**: `/help` - List of commands
- **Message Echo**: Any non-command message gets echoed back

## Quick Start

### 1. Prerequisites

- Node.js >= 20.18.0
- Telegram Bot Token from [@BotFather](https://t.me/botfather)

### 2. Setup

```bash
# Navigate to the template root (not this example directory)
cd ../..

# Install dependencies (if you haven't already)
npm install

# Create .env file
cp .env.example .env
```

### 3. Configure

Edit `.env` and set:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
BOT_ADMIN_IDS=your_user_id
```

### 4. Customize for Echo Bot

Replace the content of `src/index.ts` with the echo bot implementation:

```typescript
import { Telegraf } from 'telegraf';
import { config } from './config';
import { logger } from './utils/logger';

class SimpleEchoBot {
  private bot: Telegraf;

  constructor() {
    this.bot = new Telegraf(config.telegramToken);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Start command
    this.bot.start((ctx) => {
      ctx.reply(
        '👋 Welcome to Simple Echo Bot!\\n\\n' +
        'I will echo back whatever you send me.\\n' +
        'Try sending me a message or use /help for commands.'
      );
    });

    // Help command
    this.bot.help((ctx) => {
      ctx.reply(
        '📚 Available Commands:\\n\\n' +
        '/start - Start the bot\\n' +
        '/help - Show this help\\n' +
        '/echo <message> - Echo a message\\n\\n' +
        'You can also just send me any message and I will echo it back!'
      );
    });

    // Echo command
    this.bot.command('echo', (ctx) => {
      const message = ctx.message.text.replace('/echo', '').trim();
      if (message) {
        ctx.reply(`🔊 Echo: ${message}`);
      } else {
        ctx.reply('Please provide a message to echo. Example: /echo Hello World');
      }
    });

    // Echo all text messages
    this.bot.on('text', (ctx) => {
      // Don't echo commands
      if (!ctx.message.text.startsWith('/')) {
        ctx.reply(`🔊 ${ctx.message.text}`);
      }
    });

    // Handle errors
    this.bot.catch((err, ctx) => {
      logger.error('Bot error', { error: err, ctx });
      ctx.reply('Sorry, an error occurred!');
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Simple Echo Bot...');
      await this.bot.launch();
      logger.info('✓ Bot is running!');

      // Enable graceful stop
      process.once('SIGINT', () => this.bot.stop('SIGINT'));
      process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    } catch (error) {
      logger.error('Failed to start bot', { error });
      throw error;
    }
  }
}

// Start the bot
const bot = new SimpleEchoBot();
bot.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

### 5. Run

```bash
npm run dev
```

## Code Explanation

### Bot Structure

```typescript
class SimpleEchoBot {
  private bot: Telegraf;

  constructor() {
    this.bot = new Telegraf(config.telegramToken);
    this.setupHandlers();
  }
```

- Creates a class to organize bot logic
- Initializes Telegraf with bot token
- Sets up handlers in constructor

### Command Handlers

```typescript
this.bot.start((ctx) => {
  ctx.reply('Welcome message');
});

this.bot.help((ctx) => {
  ctx.reply('Help message');
});

this.bot.command('echo', (ctx) => {
  // Custom command logic
});
```

- `start()` - Handles `/start` command
- `help()` - Handles `/help` command
- `command(name, handler)` - Custom command handler

### Message Handlers

```typescript
this.bot.on('text', (ctx) => {
  if (!ctx.message.text.startsWith('/')) {
    ctx.reply(`Echo: ${ctx.message.text}`);
  }
});
```

- Listens to all text messages
- Filters out commands (starting with `/`)
- Echoes back the message

### Error Handling

```typescript
this.bot.catch((err, ctx) => {
  logger.error('Bot error', { error: err, ctx });
  ctx.reply('Sorry, an error occurred!');
});
```

- Catches and logs errors
- Sends friendly error message to user

### Graceful Shutdown

```typescript
process.once('SIGINT', () => this.bot.stop('SIGINT'));
process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
```

- Handles Ctrl+C gracefully
- Stops bot properly on termination

## Customization Ideas

Once you understand the basics, try:

1. **Add More Commands**
   ```typescript
   this.bot.command('reverse', (ctx) => {
     const msg = ctx.message.text.replace('/reverse', '').trim();
     ctx.reply(msg.split('').reverse().join(''));
   });
   ```

2. **Add Inline Keyboards**
   ```typescript
   this.bot.start((ctx) => {
     ctx.reply('Choose an option:', {
       reply_markup: {
         inline_keyboard: [
           [{ text: 'Button 1', callback_data: 'btn1' }],
           [{ text: 'Button 2', callback_data: 'btn2' }],
         ],
       },
     });
   });

   this.bot.action('btn1', (ctx) => {
     ctx.answerCbQuery('You clicked Button 1!');
   });
   ```

3. **Add Message Types**
   ```typescript
   this.bot.on('photo', (ctx) => {
     ctx.reply('Nice photo!');
   });

   this.bot.on('sticker', (ctx) => {
     ctx.reply('Cool sticker!');
   });
   ```

4. **Add User Tracking**
   ```typescript
   const users = new Set();

   this.bot.use((ctx, next) => {
     users.add(ctx.from?.id);
     console.log(`Total users: ${users.size}`);
     return next();
   });
   ```

## Next Steps

After mastering this simple bot, explore:

1. **Configuration System**: Learn to use `src/config/botConfig.ts`
2. **Data Providers**: Implement `IDataProvider` for external data
3. **AI Integration**: Add Claude AI for smart responses
4. **Scheduling**: Add automated tasks with cron
5. **Admin System**: Use role-based permissions

See the [Nigerian Investment Bot example](../nigerian-investment-bot/) for a complete, production-ready implementation.

## Common Issues

### Bot doesn't respond
- Check `TELEGRAM_BOT_TOKEN` is correct
- Ensure bot is running (`npm run dev`)
- Verify bot isn't already running elsewhere

### Bot responds to all messages in groups
- This is expected behavior for this simple example
- For production bots, add filters for mentions/replies
- See main template for group behavior configuration

## Learn More

- [Telegraf Documentation](https://telegraf.js.org/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Main Template README](../../README.md)

## License

MIT - Same as main template
