import { Context } from 'telegraf';
import { Message } from 'telegraf/types';
import aiService from '../services/aiService';
import marketDataService from '../services/marketData';
import { Logger } from '../utils/logger';
import InputValidator from '../utils/inputValidator';
import errorMonitor from '../utils/errorMonitor';
import userBlocker from '../utils/userBlocker';

const logger = new Logger('MessageHandlers');

export class MessageHandlers {
  private botUsername: string = '';
  private chatMessageHistory: Map<number, Array<{ text: string; userId: number; timestamp: number }>> = new Map();
  private static readonly MAX_HISTORY_PER_CHAT = 20;
  private static readonly MAX_CHATS = 50;
  private static readonly HISTORY_TTL = 900000; // 15 minutes

  setBotUsername(username: string): void {
    this.botUsername = username;
    logger.info(`Bot username set to: ${username}`);

    // Clean up old message history periodically (every 10 minutes)
    setInterval(() => this.cleanupOldHistory(), 600000);
  }

  /**
   * Add natural delay (5-15 seconds normal, 20-40 seconds if busy)
   * This gives humans a chance to respond first while keeping bot responsive
   */
  private async addNaturalDelay(chatId: number): Promise<void> {
    const history = this.chatMessageHistory.get(chatId) || [];
    const now = Date.now();
    const recentMessages = history.filter(m => now - m.timestamp < 60000).length;

    let delaySeconds: number;
    if (recentMessages > 3) {
      delaySeconds = 20 + Math.random() * 20; // 20-40 seconds (busy chat)
      logger.info(`Busy chat (${recentMessages} msgs). Waiting ${Math.floor(delaySeconds)} seconds`);
    } else {
      delaySeconds = 5 + Math.random() * 10; // 5-15 seconds (normal chat)
      logger.info(`Natural delay: ${Math.floor(delaySeconds)} seconds`);
    }

    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
  }

  /**
   * Check if someone else already answered
   * @param chatId The chat ID
   * @param questionTime When the original question was asked
   * @param questionUserId The user who asked the question (to exclude their own messages)
   */
  private hasRecentAnswer(chatId: number, questionTime: number, questionUserId: number): boolean {
    const history = this.chatMessageHistory.get(chatId) || [];
    const answersAfter = history.filter(m =>
      m.timestamp > questionTime &&
      m.userId !== 0 &&
      m.userId !== questionUserId && // Exclude the question asker's own messages
      (Date.now() - m.timestamp) < 120000
    );
    return answersAfter.length > 0;
  }

  /**
   * Track message
   */
  private trackMessage(chatId: number, text: string, userId: number): void {
    // Check if we need to evict old chats
    if (!this.chatMessageHistory.has(chatId) && this.chatMessageHistory.size >= MessageHandlers.MAX_CHATS) {
      this.evictOldestChat();
    }

    if (!this.chatMessageHistory.has(chatId)) {
      this.chatMessageHistory.set(chatId, []);
    }
    const history = this.chatMessageHistory.get(chatId)!;
    history.push({ text, userId, timestamp: Date.now() });

    // Keep only last MAX_HISTORY_PER_CHAT messages
    if (history.length > MessageHandlers.MAX_HISTORY_PER_CHAT) {
      history.shift();
    }

    // Remove messages older than TTL
    const cutoff = Date.now() - MessageHandlers.HISTORY_TTL;
    this.chatMessageHistory.set(chatId, history.filter(m => m.timestamp > cutoff));
  }

  /**
   * Clean up old message history
   */
  private cleanupOldHistory(): void {
    const now = Date.now();
    const cutoff = now - MessageHandlers.HISTORY_TTL;
    let cleaned = 0;

    this.chatMessageHistory.forEach((history, chatId) => {
      const filteredHistory = history.filter(m => m.timestamp > cutoff);

      if (filteredHistory.length === 0) {
        this.chatMessageHistory.delete(chatId);
        cleaned++;
      } else if (filteredHistory.length < history.length) {
        this.chatMessageHistory.set(chatId, filteredHistory);
      }
    });

    if (cleaned > 0) {
      logger.info(`Cleaned up message history for ${cleaned} inactive chats`);
    }
  }

  /**
   * Evict oldest chat when limit reached
   */
  private evictOldestChat(): void {
    let oldestChatId: number | null = null;
    let oldestTime = Infinity;

    this.chatMessageHistory.forEach((history, chatId) => {
      if (history.length > 0) {
        const lastMessageTime = Math.max(...history.map(m => m.timestamp));
        if (lastMessageTime < oldestTime) {
          oldestTime = lastMessageTime;
          oldestChatId = chatId;
        }
      }
    });

    if (oldestChatId !== null) {
      this.chatMessageHistory.delete(oldestChatId);
      logger.info(`Evicted message history for oldest chat ${oldestChatId}`);
    }
  }

  /**
   * Split long response into 2 parts
   */
  private splitLongResponse(response: string): string[] {
    const maxLength = 800;
    if (response.length <= maxLength) return [response];

    const midPoint = Math.floor(response.length / 2);
    const splitPoint = response.indexOf('\n\n', midPoint - 200);

    if (splitPoint > 0 && splitPoint < response.length - 200) {
      return [response.substring(0, splitPoint).trim(), response.substring(splitPoint).trim()];
    }

    const sentences = response.match(/[^.!?]+[.!?]+/g) || [response];
    const mid = Math.floor(sentences.length / 2);
    return [
      sentences.slice(0, mid).join(' ').trim(),
      sentences.slice(mid).join(' ').trim()
    ];
  }

  /**
   * Handle incoming text messages
   */
  async handleText(ctx: Context): Promise<void> {
    try {
      const message = ctx.message as Message.TextMessage;
      const chatId = ctx.chat?.id;
      const userId = ctx.from?.id;
      const username = ctx.from?.username;
      const text = message.text;
      const messageTime = message.date * 1000;

      if (!chatId || !userId || !text) return;

      // Check if user is blocked
      if (userBlocker.isBlocked(userId)) {
        logger.warn(`Blocked user ${userId} (${username || 'unknown'}) attempted to send message`);
        return; // Silently ignore messages from blocked users
      }

      // Validate chat ID and user ID
      const chatValidation = InputValidator.validateChatId(chatId);
      const userValidation = InputValidator.validateUserId(userId);

      if (!chatValidation.valid || !userValidation.valid) {
        logger.error(`Invalid chat ID or user ID: ${chatValidation.error}, ${userValidation.error}`);
        return;
      }

      // Validate and sanitize message text
      const messageValidation = InputValidator.validateMessage(text);
      if (!messageValidation.valid) {
        logger.warn(`Invalid message from user ${userId}: ${messageValidation.error}`);
        await ctx.reply('❌ Your message contains invalid content and cannot be processed.');
        return;
      }

      const sanitizedText = messageValidation.sanitized;

      logger.info(`Received message in chat ${chatId} from user ${userId}: ${sanitizedText.substring(0, 50)}...`);

      this.trackMessage(chatId, sanitizedText, userId);

      if (!aiService.shouldRespond(sanitizedText, this.botUsername)) {
        logger.debug(`Message doesn't require response`);
        return;
      }

      // Check if this is a DM (private chat) or a group
      const isPrivateChat = ctx.chat?.type === 'private';

      // Only add delay in groups (not in DMs for better user experience)
      if (!isPrivateChat) {
        await this.addNaturalDelay(chatId);

        // Only check for "someone else answered" in groups (not in DMs)
        if (this.hasRecentAnswer(chatId, messageTime, userId)) {
          logger.info('Someone else already answered. Skipping.');
          return;
        }
      }

      await ctx.sendChatAction('typing');

      const marketSummary = await marketDataService.getFundsSummary();

      let newsContext = '';
      try {
        const recentNews = await marketDataService.getFinancialNews(5);
        if (recentNews.length > 0) {
          newsContext = recentNews
            .map(item => {
              return `Title: ${item.title}\nSummary: ${item.summary}\nSource: ${item.source}\nURL: ${item.url || 'N/A'}\nDate: ${item.publishedAt.toLocaleDateString('en-NG')}`;
            })
            .join('\n---\n');
        }
      } catch (error) {
        logger.warn('Could not fetch news context:', error);
      }

      const response = await aiService.generateResponse(
        userId,
        chatId,
        sanitizedText,
        username,
        marketSummary,
        newsContext
      );

      const parts = this.splitLongResponse(response);

      await ctx.reply(parts[0], {
        parse_mode: 'Markdown',
        reply_parameters: { message_id: message.message_id },
      });

      if (parts.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await ctx.reply(parts[1], { parse_mode: 'Markdown' });
      }

      logger.info(`Sent AI response to chat ${chatId}`);
      this.trackMessage(chatId, response, 0);
    } catch (error) {
      const chatId = (ctx.message as any)?.chat?.id;
      const userId = ctx.from?.id;
      errorMonitor.trackError('message_handler', error as Error, { chatId, userId });

      try {
        await ctx.reply(
          '❌ Sorry, I encountered an error. Please try again or use /help.'
        );
      } catch (replyError) {
        errorMonitor.trackError('error_reply_failed', replyError as Error, { chatId, userId });
      }
    }
  }

  async handleNewChatMembers(ctx: Context): Promise<void> {
    try {
      const message = ctx.message as any;
      const newMembers = message.new_chat_members || [];

      const botAdded = newMembers.some(
        (member: any) => member.username === this.botUsername
      );

      if (botAdded) {
        const welcomeMessage = `👋 Hello everyone! I'm the Nigerian Investment Bot!

I'm here to help keep this group informed about:
💰 Nigerian mutual funds performance
📊 Fund types (Money Market, Fixed Income, Dollar, Balanced, Equity)
📰 Financial news and market insights
💬 Investment discussions and education

*Quick Start:*
• Use /help to see all commands
• Use /funds to explore mutual funds
• Ask me questions about Nigerian mutual funds
• I'll automatically join relevant conversations

Let's make informed investment decisions together! 🚀`;

        await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
        logger.info(`Bot added to group ${ctx.chat?.id}`);
      }
    } catch (error) {
      logger.error('Error handling new chat members:', error);
    }
  }

  async handleGroupUpdate(ctx: Context): Promise<void> {
    try {
      logger.debug(`Group update in chat ${ctx.chat?.id}`);
    } catch (error) {
      logger.error('Error handling group update:', error);
    }
  }

  async handleInlineQuery(ctx: Context): Promise<void> {
    try {
      const query = (ctx as any).inlineQuery?.query;
      logger.info(`Inline query received: ${query}`);

      await (ctx as any).answerInlineQuery([]);
    } catch (error) {
      logger.error('Error handling inline query:', error);
    }
  }
}

export default new MessageHandlers();
