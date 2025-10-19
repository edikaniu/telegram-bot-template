import Anthropic from '@anthropic-ai/sdk';
import { ConversationContext } from '../types';
import { Logger } from '../utils/logger';
import serviceHealthMonitor from '../utils/serviceHealth';
import config from '../config';

const logger = new Logger('AIService');

export class AIService {
  private anthropic: Anthropic | null = null;
  private conversationContexts: Map<number, ConversationContext> = new Map();
  private static readonly MAX_CONTEXTS = 100; // Limit number of stored contexts
  private static readonly CONTEXT_TTL = 3600000; // 1 hour in milliseconds

  constructor() {
    // Register service for health monitoring
    serviceHealthMonitor.registerService('ai-service');

    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
      logger.info('AI service initialized with Anthropic');
    } else {
      logger.warn('No AI API key provided. AI features will be disabled.');
    }

    // Clean up old contexts periodically (every 10 minutes)
    setInterval(() => this.cleanupOldContexts(), 600000);
  }

  /**
   * Generate an intelligent response to a user query about Nigerian financial markets
   */
  async generateResponse(
    userId: number,
    chatId: number,
    userMessage: string,
    username?: string,
    marketContext?: string,
    newsContext?: string
  ): Promise<string> {
    if (!this.anthropic) {
      return this.getFallbackResponse(userMessage);
    }

    try {
      // Get or create conversation context
      let context = this.conversationContexts.get(chatId);
      if (!context) {
        // Check if we need to evict old contexts
        if (this.conversationContexts.size >= AIService.MAX_CONTEXTS) {
          this.evictOldestContext();
        }

        context = {
          chatId,
          userId,
          username,
          lastInteraction: new Date(),
          conversationHistory: [],
        };
        this.conversationContexts.set(chatId, context);
      }

      // Update last interaction time
      context.lastInteraction = new Date();

      // Add user message to history
      context.conversationHistory.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      });

      // Keep only last 10 messages to manage token usage
      if (context.conversationHistory.length > 10) {
        context.conversationHistory = context.conversationHistory.slice(-10);
      }

      // Build system prompt
      const systemPrompt = `You are a knowledgeable Nigerian mutual funds advisor in a Telegram group.

IMPORTANT RESPONSE GUIDELINES:
- Keep responses SHORT and CONCISE (2-4 paragraphs max)
- Get straight to the point
- Use simple, clear language
- Use emojis sparingly (1-2 per response)
- Focus on the most important 2-3 points

Your role:
PRIMARY FOCUS - Mutual Funds Expertise:
- Answer questions about Nigerian mutual funds
- Explain fund types: Money Market, Fixed Income, Dollar, Balanced, Equity
- Help understand fund performance (NAV, returns, yields)
- Compare funds and managers
- Discuss fund managers: Stanbic IBTC, ARM, Coronation, FCMB, Vetiva, FBNQuest, Meristem, etc.
- How CBN policies affect fund performance
- Investment strategies through mutual funds

SECONDARY - General Investment Knowledge:
When users ask general investment questions (stocks, bonds, real estate, crypto, etc.):
- Provide helpful, balanced insights and recommendations
- Discuss general investment concepts (diversification, risk management, asset allocation)
- Explain different investment instruments and their characteristics
- Offer general investment advice and best practices
- Connect back to mutual funds when relevant and natural
- Be educational and helpful - don't refuse general investment questions

Guidelines:
- Mutual funds questions: Give detailed, specific answers with examples
- General investment questions: Answer helpfully, relate to mutual funds when appropriate
- This is educational guidance, not formal financial advice
- Provide insights on Nigerian economic trends

CRITICAL - When users ask about NEWS (e.g., "latest news", "what's new", "news today"):
You MUST format and display the actual news articles provided below. DO NOT SUMMARIZE.
Format each article EXACTLY like this:
📰 *[Article Title]*
[Article Summary]
_Source: [Source Name]_
🔗 [Article URL]

${marketContext ? `\nCurrent Fund Performance Context:\n${marketContext}` : ''}
${newsContext ? `\nRecent Financial News Articles (DISPLAY these when user asks about news):\n${newsContext}` : ''}

Keep responses concise (2-4 paragraphs) and conversational for a group chat setting.
You're a mutual funds specialist who can also discuss broader investing - strike a helpful balance.`;

      // Build conversation history for API
      const messages = context.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call Anthropic API
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages as any,
      });

      const assistantMessage = response.content[0].type === 'text'
        ? response.content[0].text
        : 'I apologize, but I encountered an error generating a response.';

      // Add assistant response to history
      context.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date(),
      });

      context.lastInteraction = new Date();

      // Record successful API call
      serviceHealthMonitor.recordSuccess('ai-service');

      logger.info(`Generated AI response for chat ${chatId}`);
      return assistantMessage;
    } catch (error) {
      // Record service failure
      const errorMsg = error instanceof Error ? error.message : String(error);
      serviceHealthMonitor.recordFailure('ai-service', errorMsg);

      logger.error('Error generating AI response:', error);
      return this.getFallbackResponse(userMessage);
    }
  }

  /**
   * Determine if a message should trigger a bot response
   */
  shouldRespond(message: string, botUsername: string): boolean {
    const lowerMessage = message.toLowerCase();

    // Respond if bot is mentioned
    if (lowerMessage.includes(`@${botUsername.toLowerCase()}`)) {
      return true;
    }

    // Keywords that should trigger responses (focused on mutual funds and finance)
    const keywords = [
      'invest', 'fund', 'mutual', 'naira', 'dollar',
      'equity', 'bond', 'treasury', 'return', 'portfolio', 'nav',
      'mutual fund', 'money market', 'fixed income', 'balance fund', 'balanced fund',
      'stanbic', 'arm', 'coronation', 'fcmb', 'vetiva', 'fbnquest', 'meristem',
      'chapel hill', 'investment one', 'united capital', 'greenwich',
      'cbn', 'interest rate', 'inflation', 'yield', 'apy', 'returns',
      'savings', 'investment strategy', 'diversify', 'risk', 'asset management',
      'finance', 'financial', 'economy', 'economic', 'market', 'news', 'latest',
      'today', 'rate', 'price', 'stock', 'shares', 'money', 'banking', 'bank'
    ];

    return keywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Generate a summary for market triggers
   */
  async generateMarketTriggerMessage(trigger: string): Promise<string> {
    if (!this.anthropic) {
      return trigger;
    }

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 512,
        system: 'You are a Nigerian financial markets commentator. Provide brief, engaging commentary on market events. Keep it to 2-3 sentences.',
        messages: [
          {
            role: 'user',
            content: `Provide brief commentary on this market event: ${trigger}`,
          },
        ],
      });

      const commentary = response.content[0].type === 'text'
        ? response.content[0].text
        : trigger;

      return `${trigger}\n\n${commentary}`;
    } catch (error) {
      logger.error('Error generating trigger message:', error);
      return trigger;
    }
  }

  /**
   * Clear conversation context for a chat
   */
  clearContext(chatId: number): void {
    this.conversationContexts.delete(chatId);
    logger.info(`Cleared conversation context for chat ${chatId}`);
  }

  /**
   * Clean up old conversation contexts (older than TTL)
   */
  private cleanupOldContexts(): void {
    const now = Date.now();
    let cleaned = 0;

    this.conversationContexts.forEach((context, chatId) => {
      const age = now - context.lastInteraction.getTime();
      if (age > AIService.CONTEXT_TTL) {
        this.conversationContexts.delete(chatId);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old conversation contexts`);
    }
  }

  /**
   * Evict oldest context when limit reached
   */
  private evictOldestContext(): void {
    let oldestChatId: number | null = null;
    let oldestTime = Infinity;

    this.conversationContexts.forEach((context, chatId) => {
      const time = context.lastInteraction.getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestChatId = chatId;
      }
    });

    if (oldestChatId !== null) {
      this.conversationContexts.delete(oldestChatId);
      logger.info(`Evicted oldest conversation context for chat ${oldestChatId}`);
    }
  }

  /**
   * Fallback responses when AI is not available
   */
  private getFallbackResponse(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('money market')) {
      return '💰 Money Market Funds invest in short-term debt securities and typically offer stable returns with high liquidity. They\'re great for preserving capital while earning competitive yields.';
    }

    if (lowerMessage.includes('equity') || lowerMessage.includes('stock')) {
      return '📈 Equity Funds invest in stocks listed on the Nigerian Stock Exchange (NGX). They offer higher return potential but come with more volatility. Good for long-term growth!';
    }

    if (lowerMessage.includes('fixed income') || lowerMessage.includes('bond')) {
      return '📊 Fixed Income Funds invest in bonds and other debt instruments. They provide regular income and are less volatile than equity funds, making them suitable for risk-averse investors.';
    }

    if (lowerMessage.includes('dollar fund')) {
      return '💵 Dollar Funds invest in foreign currency-denominated assets, providing a hedge against naira depreciation. They help preserve value in dollar terms.';
    }

    if (lowerMessage.includes('balance')) {
      return '⚖️ Balanced Funds combine both equity and fixed income investments, offering a middle ground between growth and stability. They\'re great for moderate risk tolerance.';
    }

    return 'I\'d love to help you with information about Nigerian investments and markets! You can ask me about different fund types, market performance, or specific investment topics. Use /help to see available commands.';
  }
}

export default new AIService();
