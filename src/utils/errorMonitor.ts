import { Logger } from './logger';
import SecurityLogger from './securityLogger';

const logger = new Logger('ErrorMonitor');

interface ErrorEntry {
  timestamp: Date;
  type: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

/**
 * Monitors error rates and alerts on suspicious patterns
 */
export class ErrorMonitor {
  private errors: Map<string, ErrorEntry[]> = new Map();
  private static readonly ERROR_WINDOW_MS = 300000; // 5 minutes
  private static readonly MAX_ERRORS_PER_WINDOW = 50;
  private static readonly CRITICAL_ERROR_THRESHOLD = 10; // Same error 10 times in window
  private alertedErrors: Set<string> = new Set();

  constructor() {
    // Clean up old errors every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Track an error
   */
  trackError(type: string, error: Error | string, context?: Record<string, any>): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    const entry: ErrorEntry = {
      timestamp: new Date(),
      type,
      message: errorMessage,
      stack: errorStack,
      context,
    };

    // Get or create error list for this type
    if (!this.errors.has(type)) {
      this.errors.set(type, []);
    }

    const errorList = this.errors.get(type)!;
    errorList.push(entry);

    // Check for error rate issues
    this.checkErrorRate(type);
    this.checkRepeatedErrors(type, errorMessage);

    // Log the error
    logger.error(`[${type}] ${errorMessage}`, context);
  }

  /**
   * Check if error rate is too high
   */
  private checkErrorRate(type: string): void {
    const recentErrors = this.getRecentErrors(type);

    if (recentErrors.length >= ErrorMonitor.MAX_ERRORS_PER_WINDOW) {
      const alertKey = `rate_${type}_${Math.floor(Date.now() / ErrorMonitor.ERROR_WINDOW_MS)}`;

      if (!this.alertedErrors.has(alertKey)) {
        this.alertedErrors.add(alertKey);

        SecurityLogger.logEvent({
          eventType: 'HIGH_ERROR_RATE',
          severity: 'critical',
          description: `High error rate detected: ${recentErrors.length} ${type} errors in 5 minutes`,
          metadata: {
            errorType: type,
            errorCount: recentErrors.length,
            windowMs: ErrorMonitor.ERROR_WINDOW_MS,
          },
        });

        logger.error(
          `🚨 ALERT: High error rate - ${recentErrors.length} ${type} errors in ${ErrorMonitor.ERROR_WINDOW_MS / 1000}s`
        );
      }
    }
  }

  /**
   * Check for repeated identical errors
   */
  private checkRepeatedErrors(type: string, message: string): void {
    const recentErrors = this.getRecentErrors(type);
    const sameErrors = recentErrors.filter(e => e.message === message);

    if (sameErrors.length >= ErrorMonitor.CRITICAL_ERROR_THRESHOLD) {
      const alertKey = `repeated_${type}_${message.substring(0, 50)}`;

      if (!this.alertedErrors.has(alertKey)) {
        this.alertedErrors.add(alertKey);

        SecurityLogger.logEvent({
          eventType: 'REPEATED_ERROR',
          severity: 'high',
          description: `Same error repeated ${sameErrors.length} times: ${message}`,
          metadata: {
            errorType: type,
            errorMessage: message,
            occurrences: sameErrors.length,
          },
        });

        logger.warn(
          `⚠️ ALERT: Repeated error (${sameErrors.length}x): ${message.substring(0, 100)}`
        );
      }
    }
  }

  /**
   * Get recent errors within the time window
   */
  private getRecentErrors(type: string): ErrorEntry[] {
    const errorList = this.errors.get(type) || [];
    const cutoff = Date.now() - ErrorMonitor.ERROR_WINDOW_MS;

    return errorList.filter(e => e.timestamp.getTime() > cutoff);
  }

  /**
   * Get all recent errors across all types
   */
  getAllRecentErrors(): ErrorEntry[] {
    const allErrors: ErrorEntry[] = [];
    const cutoff = Date.now() - ErrorMonitor.ERROR_WINDOW_MS;

    this.errors.forEach(errorList => {
      const recent = errorList.filter(e => e.timestamp.getTime() > cutoff);
      allErrors.push(...recent);
    });

    return allErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: number;
    topErrors: Array<{ type: string; message: string; count: number }>;
  } {
    const cutoff = Date.now() - ErrorMonitor.ERROR_WINDOW_MS;
    const errorsByType: Record<string, number> = {};
    const errorMessages: Map<string, { type: string; count: number }> = new Map();

    let totalErrors = 0;
    let recentErrors = 0;

    this.errors.forEach((errorList, type) => {
      errorsByType[type] = 0;

      errorList.forEach(error => {
        totalErrors++;

        if (error.timestamp.getTime() > cutoff) {
          recentErrors++;
          errorsByType[type]++;

          const key = `${type}:${error.message}`;
          if (!errorMessages.has(key)) {
            errorMessages.set(key, { type, count: 0 });
          }
          errorMessages.get(key)!.count++;
        }
      });
    });

    // Get top 10 most frequent errors
    const topErrors = Array.from(errorMessages.entries())
      .map(([message, data]) => ({
        type: data.type,
        message: message.split(':')[1],
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors,
      errorsByType,
      recentErrors,
      topErrors,
    };
  }

  /**
   * Clean up old errors
   */
  private cleanup(): void {
    const cutoff = Date.now() - ErrorMonitor.ERROR_WINDOW_MS * 2; // Keep 10 minutes of history
    let cleaned = 0;

    this.errors.forEach((errorList, type) => {
      const initialLength = errorList.length;
      const filtered = errorList.filter(e => e.timestamp.getTime() > cutoff);

      if (filtered.length < initialLength) {
        this.errors.set(type, filtered);
        cleaned += initialLength - filtered.length;
      }

      // Remove empty error types
      if (filtered.length === 0) {
        this.errors.delete(type);
      }
    });

    // Clean up old alert keys
    const currentWindow = Math.floor(Date.now() / ErrorMonitor.ERROR_WINDOW_MS);
    this.alertedErrors.forEach(key => {
      if (key.startsWith('rate_')) {
        const parts = key.split('_');
        const window = parseInt(parts[parts.length - 1]);
        if (window < currentWindow - 2) {
          this.alertedErrors.delete(key);
        }
      }
    });

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} old error entries`);
    }
  }

  /**
   * Check if system is healthy (low error rate)
   */
  isHealthy(): boolean {
    const recentErrors = this.getAllRecentErrors();
    return recentErrors.length < ErrorMonitor.MAX_ERRORS_PER_WINDOW;
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    errorCount: number;
    errorRate: string;
    issues: string[];
  } {
    const stats = this.getErrorStats();
    const healthy = this.isHealthy();
    const issues: string[] = [];

    if (stats.recentErrors >= ErrorMonitor.MAX_ERRORS_PER_WINDOW) {
      issues.push(`High error rate: ${stats.recentErrors} errors in 5 minutes`);
    }

    stats.topErrors.forEach(error => {
      if (error.count >= ErrorMonitor.CRITICAL_ERROR_THRESHOLD) {
        issues.push(`Repeated error: "${error.message}" (${error.count}x)`);
      }
    });

    return {
      healthy,
      errorCount: stats.recentErrors,
      errorRate: `${stats.recentErrors} errors / 5 min`,
      issues,
    };
  }
}

export default new ErrorMonitor();
