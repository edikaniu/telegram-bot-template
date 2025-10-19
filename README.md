# Telegram Bot Template

A feature-rich, production-ready Telegram bot template built with TypeScript. Perfect for quickly building custom Telegram bots with AI integration, scheduling, admin management, and more.

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.18.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.9.3-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

### Core Functionality
- **Telegraf Framework** - Built on the powerful Telegraf library for Telegram Bot API
- **TypeScript** - Fully typed for better developer experience and fewer bugs
- **Modular Architecture** - Clean separation of concerns with handlers, services, and utilities
- **Customizable Configuration** - Easy-to-configure bot settings, commands, and messages

### AI Integration
- **Anthropic Claude Support** - Built-in integration with Claude AI for conversational responses
- **OpenAI Ready** - Prepared for GPT integration (implementation pending)
- **Context-Aware Conversations** - Maintains chat history for natural conversations
- **Fallback Responses** - Graceful degradation when AI services are unavailable

### Data Management
- **Pluggable Data Providers** - Abstract interface for any data source (APIs, scrapers, databases)
- **Pluggable News Providers** - Abstract interface for news/content aggregation
- **Caching System** - Configurable TTL-based caching for performance
- **JSON File Storage** - Simple file-based persistence (easily switchable to databases)
- **Automated Backups** - Daily backups with configurable retention

### Scheduling & Automation
- **Cron-Based Scheduler** - Automated tasks using node-cron
- **Timezone Support** - Configurable timezone for scheduled tasks
- **Custom Intervals** - Flexible scheduling for data refresh, summaries, monitoring
- **Background Jobs** - Non-blocking task execution

### Security & Administration
- **Role-Based Access Control** - Super Admin, Admin, Moderator, and Viewer roles
- **User Blocking System** - Block abusive users with reasons and expiration
- **Rate Limiting** - Per-command and per-user rate limits
- **Input Validation** - Protection against malicious input
- **Security Logging** - Audit trail for admin actions and security events

### Monitoring & Analytics
- **Health Checks** - Monitor bot and service health
- **Usage Analytics** - Track command usage and user engagement
- **Error Monitoring** - Categorized error tracking with context
- **Service Health Dashboard** - Real-time status of all bot services

### Group Chat Features
- **Natural Delays** - Humanlike response timing in groups
- **Duplicate Prevention** - Avoids responding if someone already answered
- **Message History** - Per-chat conversation tracking
- **Configurable Behavior** - Adjust delays, thresholds, and response patterns

## Quick Start

### Prerequisites

- Node.js ≥ 20.18.0
- npm ≥ 10.0.0
- A Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- (Optional) Anthropic API key for AI features

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/edikaniu/telegram-bot-template.git
   cd telegram-bot-template
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browser** (if using web scraping)
   ```bash
   npm run install-browser
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your configuration:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   BOT_ADMIN_IDS=your_telegram_user_id
   ANTHROPIC_API_KEY=your_claude_api_key  # Optional
   ```

5. **Run the bot**

   Development mode (with auto-reload):
   ```bash
   npm run dev
   ```

   Production mode:
   ```bash
   npm run build
   npm start
   ```

### Getting Your Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the prompts to choose a name and username
4. Copy the token provided and add it to your `.env` file

### Getting Your User ID

1. Open Telegram and search for [@userinfobot](https://t.me/userinfobot)
2. Send any message to the bot
3. Copy your user ID and add it to `.env` as `BOT_ADMIN_IDS`

## Project Structure

```
telegram-bot-template/
├── src/
│   ├── config/
│   │   ├── index.ts              # Environment configuration
│   │   └── botConfig.ts          # Bot customization settings
│   ├── interfaces/
│   │   ├── IDataProvider.ts      # Data provider interface
│   │   └── INewsProvider.ts      # News provider interface
│   ├── handlers/
│   │   ├── commands.ts           # Command handlers
│   │   ├── messages.ts           # Message & conversation handlers
│   │   ├── adminCommands.ts      # Admin-specific commands
│   │   └── blockCommands.ts      # User blocking commands
│   ├── services/
│   │   ├── aiService.ts          # AI integration (Claude)
│   │   ├── marketData.ts         # Data aggregation service
│   │   ├── scraperService.ts     # Web scraping service
│   │   ├── newsScraperService.ts # News aggregation service
│   │   └── scheduler.ts          # Cron job scheduler
│   ├── utils/
│   │   ├── logger.ts             # Logging utility
│   │   ├── rateLimiter.ts        # Rate limiting
│   │   ├── inputValidator.ts     # Input validation
│   │   ├── userBlocker.ts        # User blocking system
│   │   ├── adminRoles.ts         # Role-based permissions
│   │   ├── securityLogger.ts     # Security event logging
│   │   ├── errorMonitor.ts       # Error tracking
│   │   ├── healthCheck.ts        # Health checks
│   │   ├── serviceHealth.ts      # Service monitoring
│   │   ├── usageAnalytics.ts     # Usage tracking
│   │   └── backupService.ts      # Data backup automation
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   └── index.ts                  # Main bot entry point
├── examples/
│   ├── nigerian-investment-bot/  # Complete example implementation
│   └── simple-echo-bot/          # Minimal example (coming soon)
├── data/                         # Bot data (gitignored)
├── backups/                      # Automated backups (gitignored)
├── tests/                        # Jest tests
├── .env.example                  # Environment variable template
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```

## Configuration

### Bot Customization

The template is designed to be easily customizable. Edit `src/config/botConfig.ts` to customize:

- **Bot Metadata**: Name, version, description
- **Message Templates**: Welcome, help, error messages
- **Commands**: Enable/disable commands, set descriptions and rate limits
- **Feature Flags**: Turn features on/off (AI, scraping, scheduling, etc.)
- **Rate Limits**: Per-command rate limiting
- **Cache Settings**: TTL for data, news, conversations
- **Schedules**: Cron expressions for automated tasks
- **Group Behavior**: Response delays, message splitting
- **Security**: Input validation, max lengths

Example customization:

```typescript
import { loadBotConfig } from './src/config/botConfig';

const myConfig = loadBotConfig({
  metadata: {
    name: 'My Awesome Bot',
    version: '1.0.0',
  },
  messages: {
    welcome: 'Welcome to my bot!',
    help: 'Here are the commands...',
  },
  features: {
    enableAI: true,
    enableDataScraping: false,
  },
});
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | - | Your Telegram bot token from @BotFather |
| `BOT_ADMIN_IDS` | Yes | - | Comma-separated admin user IDs |
| `ANTHROPIC_API_KEY` | No | - | Anthropic Claude API key for AI features |
| `OPENAI_API_KEY` | No | - | OpenAI API key (not yet implemented) |
| `ALLOWED_GROUP_IDS` | No | - | Group IDs for automated broadcasts |
| `MARKET_UPDATE_INTERVAL` | No | 30 | Data refresh interval (minutes) |
| `NEWS_CHECK_INTERVAL` | No | 15 | News check interval (minutes) |
| `NODE_ENV` | No | production | Environment: development, production, test |

See [`.env.example`](.env.example) for detailed documentation.

## Commands

### Default Commands

| Command | Description | Admin Only |
|---------|-------------|------------|
| `/start` | Start the bot | No |
| `/help` | Show help message | No |
| `/about` | About the bot | No |
| `/clear` | Clear conversation history | No |

### Admin Commands

| Command | Description | Permission Level |
|---------|-------------|------------------|
| `/health` | System health check | Admin |
| `/stats` | Usage statistics | Admin |
| `/refresh` | Force data refresh | Admin |
| `/backup` | Trigger manual backup | Admin |
| `/block <id> <reason>` | Block a user | Admin |
| `/unblock <id>` | Unblock a user | Admin |
| `/blocklist` | View blocked users | Admin |
| `/admins` | List all admins | Admin |
| `/mypermissions` | View your permissions | Admin |
| `/addadmin <id> <role>` | Add admin | Super Admin |
| `/removeadmin <id>` | Remove admin | Super Admin |

## Customization Guide

### Adding Custom Commands

1. **Define the command** in `src/config/botConfig.ts`:
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

2. **Implement the handler** in `src/handlers/commands.ts`:
   ```typescript
   bot.command('mycommand', async (ctx) => {
     await ctx.reply('Hello from my custom command!');
   });
   ```

### Creating a Data Provider

Implement the `IDataProvider` interface to connect any data source:

```typescript
import { BaseDataProvider, DataItem } from './interfaces/IDataProvider';

interface MyDataItem extends DataItem {
  customField: string;
}

class MyDataProvider extends BaseDataProvider<MyDataItem> {
  async fetchAll(forceRefresh?: boolean): Promise<MyDataItem[]> {
    // Fetch from your data source (API, database, etc.)
    const data = await fetch('https://api.example.com/data');
    this.updateCache(data);
    return data;
  }

  async fetchByType(type: string): Promise<MyDataItem[]> {
    const all = await this.fetchAll();
    return all.filter(item => item.type === type);
  }

  async healthCheck() {
    // Check if data source is accessible
    return { healthy: true };
  }
}
```

### Creating a News Provider

Implement the `INewsProvider` interface for news aggregation:

```typescript
import { BaseNewsProvider, NewsArticle } from './interfaces/INewsProvider';

class MyNewsProvider extends BaseNewsProvider {
  async fetchLatest(forceRefresh?: boolean): Promise<NewsArticle[]> {
    // Fetch from your news source
    const articles = await fetch('https://api.news.com/latest');
    this.updateCache(articles);
    return articles;
  }

  async healthCheck() {
    return { healthy: true };
  }
}
```

### Adding Scheduled Tasks

Add cron jobs in `src/services/scheduler.ts`:

```typescript
cron.schedule('0 9 * * *', async () => {
  // Runs daily at 9 AM
  console.log('Running daily task...');
});
```

## Examples

### Nigerian Investment Bot

A complete, production-ready example that demonstrates:
- Web scraping with Playwright
- Multi-source news aggregation
- AI-powered conversations
- Scheduled data updates
- Admin management

See: [`examples/nigerian-investment-bot/`](examples/nigerian-investment-bot/)

### Simple Echo Bot (Coming Soon)

A minimal example showing the basics:
- Simple command handling
- Basic message responses
- No external dependencies

## Deployment

### Railway.app (Recommended)

1. Create account on [Railway.app](https://railway.app)
2. Create new project from GitHub repo
3. Add environment variables in Railway dashboard
4. Deploy!

Railway configuration is included in `railway.json`.

### Heroku

1. Create Heroku app: `heroku create`
2. Set environment variables: `heroku config:set TELEGRAM_BOT_TOKEN=...`
3. Deploy: `git push heroku main`

### VPS (Ubuntu/Debian)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone https://github.com/edikaniu/telegram-bot-template.git
cd telegram-bot-template
npm install
npm run build

# Set up environment variables
cp .env.example .env
nano .env

# Run with PM2 (process manager)
sudo npm install -g pm2
pm2 start dist/index.js --name telegram-bot
pm2 save
pm2 startup
```

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for detailed deployment guides.

## Testing

Run tests with Jest:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Best Practices

### Security
- Never commit `.env` files
- Rotate API keys regularly
- Limit admin access
- Use rate limiting to prevent abuse
- Validate all user input

### Performance
- Use caching effectively
- Implement rate limiting
- Monitor memory usage for long-running bots
- Clean up old conversation contexts

### Error Handling
- Always use try-catch for async operations
- Log errors with context
- Provide user-friendly error messages
- Monitor error rates

### Development
- Use TypeScript for type safety
- Follow the modular architecture
- Keep handlers thin, services fat
- Write tests for critical functionality
- Document custom implementations

## Troubleshooting

### Bot doesn't respond
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Check bot is running: `npm run dev`
- Ensure no other instance is running
- Check logs for errors

### AI not working
- Verify `ANTHROPIC_API_KEY` is set
- Check API key is valid
- Ensure sufficient API credits
- Check network connectivity

### Rate limit errors
- Adjust rate limits in `botConfig.ts`
- Ensure you're not making too many Telegram API calls
- Check for infinite loops

### Deployment issues
- Verify all environment variables are set on platform
- Check Node.js version matches requirements (≥20.18.0)
- Ensure build succeeded: `npm run build`
- Check platform logs for errors

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please ensure:
- Code follows existing style
- All tests pass
- New features have tests
- Documentation is updated

## Architecture

For detailed architecture documentation, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Customization Guide

For step-by-step customization instructions, see [`CUSTOMIZATION.md`](CUSTOMIZATION.md).

## License

MIT License - feel free to use this template for any purpose.

See [LICENSE](LICENSE) for details.

## Support

- **Documentation**: Check the docs in this repository
- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions
- **Examples**: See [`examples/`](examples/) directory

## Acknowledgments

- Built with [Telegraf](https://telegraf.js.org/)
- AI powered by [Anthropic Claude](https://www.anthropic.com/)
- Web scraping with [Playwright](https://playwright.dev/)
- Scheduling with [node-cron](https://github.com/node-cron/node-cron)

## Roadmap

- [ ] Add OpenAI/GPT integration
- [ ] Add webhook support (currently uses long polling)
- [ ] Add database integration examples (PostgreSQL, MongoDB)
- [ ] Add more example implementations
- [ ] Add interactive setup wizard (`npm run init`)
- [ ] Add Docker support
- [ ] Add CI/CD examples (GitHub Actions)
- [ ] Add internationalization (i18n) support
- [ ] Add more comprehensive tests
- [ ] Add Grafana/Prometheus monitoring

## Star History

If you find this template useful, please consider giving it a star! ⭐

---

**Made with ❤️ for the Telegram bot community**
