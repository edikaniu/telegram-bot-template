import { Logger } from './logger';

const logger = new Logger('RateLimiter');

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface CommandLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private userLimits: Map<string, RateLimitEntry> = new Map();
  private commandLimits: Map<string, CommandLimitConfig> = new Map();

  constructor() {
    // Define rate limits for different commands
    this.commandLimits.set('default', { maxRequests: 5, windowMs: 60000 }); // 5 per minute
    this.commandLimits.set('refresh', { maxRequests: 1, windowMs: 600000 }); // 1 per 10 minutes
    this.commandLimits.set('search', { maxRequests: 10, windowMs: 60000 }); // 10 per minute
    this.commandLimits.set('funds', { maxRequests: 10, windowMs: 60000 }); // 10 per minute
    this.commandLimits.set('news', { maxRequests: 10, windowMs: 60000 }); // 10 per minute

    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Check if user is rate limited for a specific command
   * @returns true if allowed, false if rate limited
   */
  checkLimit(userId: number, command: string = 'default'): boolean {
    const key = `${userId}:${command}`;
    const limit = this.commandLimits.get(command) || this.commandLimits.get('default')!;
    const now = Date.now();

    let entry = this.userLimits.get(key);

    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      this.userLimits.set(key, {
        count: 1,
        resetTime: now + limit.windowMs,
      });
      return true;
    }

    if (entry.count < limit.maxRequests) {
      // Increment count
      entry.count++;
      return true;
    }

    // Rate limited
    const secondsRemaining = Math.ceil((entry.resetTime - now) / 1000);
    logger.warn(`User ${userId} rate limited on ${command}. Retry in ${secondsRemaining}s`);
    return false;
  }

  /**
   * Get remaining time until rate limit resets (in seconds)
   */
  getResetTime(userId: number, command: string = 'default'): number {
    const key = `${userId}:${command}`;
    const entry = this.userLimits.get(key);

    if (!entry) return 0;

    const remaining = Math.ceil((entry.resetTime - Date.now()) / 1000);
    return Math.max(0, remaining);
  }

  /**
   * Get current usage count for user on a command
   */
  getUsageCount(userId: number, command: string = 'default'): number {
    const key = `${userId}:${command}`;
    const entry = this.userLimits.get(key);
    return entry?.count || 0;
  }

  /**
   * Get max allowed requests for a command
   */
  getLimit(command: string = 'default'): number {
    const limit = this.commandLimits.get(command) || this.commandLimits.get('default')!;
    return limit.maxRequests;
  }

  /**
   * Manually reset limit for a user (admin use)
   */
  resetLimit(userId: number, command?: string): void {
    if (command) {
      const key = `${userId}:${command}`;
      this.userLimits.delete(key);
      logger.info(`Reset rate limit for user ${userId} on ${command}`);
    } else {
      // Reset all limits for this user
      const keysToDelete: string[] = [];
      this.userLimits.forEach((_, key) => {
        if (key.startsWith(`${userId}:`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.userLimits.delete(key));
      logger.info(`Reset all rate limits for user ${userId}`);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    this.userLimits.forEach((entry, key) => {
      if (now > entry.resetTime) {
        this.userLimits.delete(key);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Get formatted error message for rate-limited users
   */
  getRateLimitMessage(userId: number, command: string = 'default'): string {
    const resetTime = this.getResetTime(userId, command);
    const limit = this.getLimit(command);

    if (resetTime === 0) return '';

    const minutes = Math.floor(resetTime / 60);
    const seconds = resetTime % 60;

    let timeStr = '';
    if (minutes > 0) {
      timeStr = `${minutes} minute${minutes > 1 ? 's' : ''}`;
      if (seconds > 0) timeStr += ` and ${seconds} second${seconds > 1 ? 's' : ''}`;
    } else {
      timeStr = `${seconds} second${seconds > 1 ? 's' : ''}`;
    }

    return `⏱️ Rate limit exceeded. You can use /${command} ${limit} times per window. Please try again in ${timeStr}.`;
  }
}

export default new RateLimiter();
