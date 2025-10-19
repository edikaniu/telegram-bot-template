# Nigerian Investment Bot Example

This is a complete implementation example showing how to use the Telegram Bot Template to create a specialized bot for Nigerian investment information.

## Overview

NairaSense is a Telegram bot that keeps Nigerian investors informed about:
- Mutual fund performance across Nigerian fund managers
- Latest financial news from trusted Nigerian sources
- Market trends and analysis
- Real-time alerts for high-performing funds

## Features Demonstrated

This example shows how to:

### 1. **Custom Configuration**
- Domain-specific message templates
- Custom command set for investment data
- Nigerian timezone scheduling
- Tailored rate limits

See: [`customConfig.ts`](./customConfig.ts)

### 2. **Data Provider Implementation**
- Web scraping from NairaCompare.ng
- Fund data aggregation and caching
- Search functionality across funds
- Type filtering (money market, fixed income, etc.)

The original implementation uses:
- `src/services/scraperService.ts` - NairaCompare scraper
- `src/services/marketData.ts` - Data aggregation service

### 3. **News Provider Implementation**
- Multi-source news scraping (Punch, Vanguard, ThisDay)
- Category-based news organization
- Duplicate prevention for broadcasts
- Automated news distribution

The original implementation uses:
- `src/services/newsScraperService.ts` - News aggregation

### 4. **AI Integration**
- Context-aware conversations about Nigerian investments
- Market data injection for knowledgeable responses
- Fallback responses when AI unavailable

The original implementation uses:
- `src/services/aiService.ts` - Anthropic Claude integration

### 5. **Scheduled Tasks**
- Daily data refresh at 6 AM (Nigerian time)
- Market monitoring at 3 PM daily
- News checks every 6 hours
- Weekly investment roundups

The original implementation uses:
- `src/services/scheduler.ts` - Cron-based scheduling

## How to Use This Example

### Option 1: Run the Current Bot (Before Template Conversion)

The current codebase IS the Nigerian investment bot. To run it:

```bash
# Install dependencies
npm install

# Install Playwright browser
npm run install-browser

# Copy environment variables
cp .env.example .env

# Edit .env and add your API keys
# Required: TELEGRAM_BOT_TOKEN, BOT_ADMIN_IDS
# Optional: ANTHROPIC_API_KEY (for AI features)

# Run in development
npm run dev

# Or build and run in production
npm run build
npm start
```

### Option 2: Use as Reference Implementation

After the template conversion is complete, you can use this example as a reference for:

1. **Creating Custom Configurations**: See how [`customConfig.ts`](./customConfig.ts) customizes the bot
2. **Implementing Data Providers**: Study the scraper and market data services
3. **Setting Up Schedulers**: Learn from the scheduling configuration
4. **Integrating AI**: See how Claude AI is integrated for conversations

## Data Sources

### Mutual Funds
- **Source**: [NairaCompare.ng](https://nairacompare.ng)
- **Fund Types**:
  - Money Market Funds
  - Fixed Income Funds
  - Dollar Funds
  - Balanced Funds
  - Equity Funds
- **Data Collected**: Fund name, manager, yield, risk profile, minimum investment

### Financial News
- **Punch Nigeria** - Business section
- **Vanguard Nigeria** - Business section
- **ThisDay** - Business section

## Commands

### Public Commands
- `/start` - Welcome message
- `/help` - Show help
- `/funds [type]` - View mutual funds by type
- `/search [query]` - Search for specific funds
- `/news` - Latest financial news
- `/about` - Bot information
- `/clear` - Clear conversation history

### Admin Commands
- `/health` - System health check
- `/stats` - Usage analytics
- `/refresh` - Force data refresh
- `/backup` - Manual backup
- `/block <id> <reason>` - Block user
- `/unblock <id>` - Unblock user
- `/blocklist` - View blocked users
- `/admins` - List admins
- `/addadmin <id> <role>` - Add admin
- `/removeadmin <id>` - Remove admin

## Configuration

### Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `BOT_ADMIN_IDS` - Comma-separated admin user IDs

Optional:
- `ANTHROPIC_API_KEY` - For AI conversations
- `ALLOWED_GROUP_IDS` - For automated broadcasts
- `MARKET_UPDATE_INTERVAL` - Default: 30 minutes
- `NEWS_CHECK_INTERVAL` - Default: 15 minutes

### Scheduling

All times are in Nigerian timezone (Africa/Lagos, UTC+1):
- **Daily Data Refresh**: 6:00 AM
- **Daily Summary**: 9:00 AM
- **Market Monitoring**: 3:00 PM
- **News Monitoring**: Every 6 hours
- **Weekly Roundup**: Friday 5:00 PM

### Rate Limits
- Default: 5 requests/minute
- `/search`, `/funds`, `/news`: 10 requests/minute
- `/refresh`: 1 request per 10 minutes (admin only)

## Architecture

```
Nigerian Investment Bot
├── Data Layer
│   ├── NairaCompare Scraper (Playwright + Cheerio)
│   ├── News Scrapers (Multiple sources)
│   └── JSON file storage (data/, backups/)
├── Service Layer
│   ├── Market Data Service (Aggregation + Search)
│   ├── News Scraper Service (Multi-source)
│   ├── AI Service (Claude integration)
│   └── Scheduler (Cron jobs)
├── Handler Layer
│   ├── Command Handlers
│   ├── Message Handlers (AI-powered)
│   ├── Admin Commands
│   └── Block Commands
└── Utility Layer
    ├── Rate Limiter
    ├── Input Validator
    ├── User Blocker
    ├── Admin Roles
    ├── Analytics
    ├── Backup Service
    └── Health Checks
```

## Customization Points

To adapt this for your own investment bot:

1. **Change Data Sources**:
   - Implement `IDataProvider` interface
   - Update scraper URLs and selectors
   - Modify data models if needed

2. **Customize Messages**:
   - Edit `customConfig.ts` message templates
   - Update help text and commands
   - Change bot personality in AI prompts

3. **Adjust Scheduling**:
   - Modify `schedules` in configuration
   - Change timezone if needed
   - Add/remove scheduled tasks

4. **Add New Commands**:
   - Define in `commands` configuration
   - Implement handler in appropriate file
   - Set rate limits and permissions

## Deployment

This bot is configured for deployment on:
- **Railway.app** (recommended) - See `railway.json`
- **Heroku** - Compatible
- **VPS** - Any Node.js compatible server

See the main template's `DEPLOYMENT.md` for detailed instructions.

## Disclaimer

This bot provides information only. Users should always consult licensed financial advisors before making investment decisions. The bot creators are not responsible for any financial decisions made based on the information provided.

## License

MIT License - See main template LICENSE file

## Support

For template-related questions, see the main template documentation.
For Nigerian investment bot specific questions, open an issue on the repository.
