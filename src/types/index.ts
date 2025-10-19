export interface FundData {
  name: string;
  fundManager: string; // Provider/Fund Manager
  type: 'money_market' | 'fixed_income' | 'dollar' | 'balance' | 'equity';
  lastUpdated: Date;
  yieldToDate?: string; // Yield percentage as string (e.g., "12.5%")
  minimumInvestment?: string;
  riskProfile?: string; // Risk level (e.g., "Low", "Medium", "High")
  url?: string; // Individual product detail page URL (scraped from NairaCompare)
  categoryUrl?: string; // Category page URL (e.g., money-market-fund-compare)
}

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  category: 'market' | 'funds' | 'economy' | 'policy' | 'stocks' | 'tech';
}

export interface BotConfig {
  telegramToken: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  adminIds: number[];
  allowedGroupIds?: number[];
  marketUpdateInterval: number; // in minutes
  newsCheckInterval: number; // in minutes
}

export interface ConversationContext {
  chatId: number;
  userId: number;
  username?: string;
  lastInteraction: Date;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
}
