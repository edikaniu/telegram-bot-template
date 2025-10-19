import { Logger } from './logger';

const logger = new Logger('InputValidator');

/**
 * Validates and sanitizes user input to prevent injection attacks
 */
export class InputValidator {
  // Maximum lengths for different input types
  private static readonly MAX_QUERY_LENGTH = 100;
  private static readonly MAX_MESSAGE_LENGTH = 4000;
  private static readonly MAX_COMMAND_LENGTH = 50;

  // Patterns for validation
  private static readonly SAFE_QUERY_PATTERN = /^[a-zA-Z0-9\s\-_.]+$/;
  private static readonly FUND_TYPE_PATTERN = /^(money_market|fixed_income|dollar|balance|equity)$/;
  private static readonly COMMAND_PATTERN = /^\/[a-z]+$/;

  /**
   * Validate search query input
   */
  static validateSearchQuery(query: string): { valid: boolean; sanitized: string; error?: string } {
    if (!query || query.trim().length === 0) {
      return { valid: false, sanitized: '', error: 'Search query cannot be empty' };
    }

    const trimmed = query.trim();

    if (trimmed.length > this.MAX_QUERY_LENGTH) {
      return {
        valid: false,
        sanitized: '',
        error: `Search query too long (max ${this.MAX_QUERY_LENGTH} characters)`,
      };
    }

    // Allow only alphanumeric, spaces, hyphens, underscores, and periods
    if (!this.SAFE_QUERY_PATTERN.test(trimmed)) {
      return {
        valid: false,
        sanitized: '',
        error: 'Search query contains invalid characters',
      };
    }

    return { valid: true, sanitized: trimmed };
  }

  /**
   * Validate fund type parameter
   */
  static validateFundType(fundType: string): { valid: boolean; sanitized: string; error?: string } {
    if (!fundType) {
      return { valid: true, sanitized: '' }; // Fund type is optional
    }

    const lowercased = fundType.toLowerCase().trim();

    if (!this.FUND_TYPE_PATTERN.test(lowercased)) {
      return {
        valid: false,
        sanitized: '',
        error: 'Invalid fund type. Use: money_market, fixed_income, dollar, balance, or equity',
      };
    }

    return { valid: true, sanitized: lowercased };
  }

  /**
   * Validate and sanitize general message text
   */
  static validateMessage(message: string): { valid: boolean; sanitized: string; error?: string } {
    if (!message || message.trim().length === 0) {
      return { valid: false, sanitized: '', error: 'Message cannot be empty' };
    }

    const trimmed = message.trim();

    if (trimmed.length > this.MAX_MESSAGE_LENGTH) {
      return {
        valid: false,
        sanitized: '',
        error: `Message too long (max ${this.MAX_MESSAGE_LENGTH} characters)`,
      };
    }

    // Remove null bytes and other control characters except newlines and tabs
    const sanitized = trimmed.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    return { valid: true, sanitized };
  }

  /**
   * Validate command format
   */
  static validateCommand(command: string): { valid: boolean; sanitized: string; error?: string } {
    if (!command || command.trim().length === 0) {
      return { valid: false, sanitized: '', error: 'Command cannot be empty' };
    }

    const trimmed = command.trim();

    if (trimmed.length > this.MAX_COMMAND_LENGTH) {
      return {
        valid: false,
        sanitized: '',
        error: `Command too long (max ${this.MAX_COMMAND_LENGTH} characters)`,
      };
    }

    if (!this.COMMAND_PATTERN.test(trimmed)) {
      return {
        valid: false,
        sanitized: '',
        error: 'Invalid command format',
      };
    }

    return { valid: true, sanitized: trimmed };
  }

  /**
   * Sanitize text for safe use in Markdown
   * Escapes special Markdown characters
   */
  static sanitizeMarkdown(text: string): string {
    if (!text) return '';

    // Escape Markdown special characters
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/~/g, '\\~')
      .replace(/`/g, '\\`')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/=/g, '\\=')
      .replace(/\|/g, '\\|')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!');
  }

  /**
   * Validate user ID
   */
  static validateUserId(userId: number | undefined): { valid: boolean; error?: string } {
    if (!userId || typeof userId !== 'number' || userId <= 0) {
      return { valid: false, error: 'Invalid user ID' };
    }

    // Telegram user IDs are positive integers less than 2^53
    if (userId > Number.MAX_SAFE_INTEGER) {
      return { valid: false, error: 'User ID out of range' };
    }

    return { valid: true };
  }

  /**
   * Validate chat ID
   */
  static validateChatId(chatId: number | undefined): { valid: boolean; error?: string } {
    if (!chatId || typeof chatId !== 'number') {
      return { valid: false, error: 'Invalid chat ID' };
    }

    // Telegram chat IDs can be negative (for groups/channels)
    if (Math.abs(chatId) > Number.MAX_SAFE_INTEGER) {
      return { valid: false, error: 'Chat ID out of range' };
    }

    return { valid: true };
  }

  /**
   * Log validation failure
   */
  static logValidationFailure(type: string, error: string, userId?: number): void {
    logger.warn(`Validation failed - Type: ${type}, Error: ${error}, User: ${userId || 'unknown'}`);
  }
}

export default InputValidator;
