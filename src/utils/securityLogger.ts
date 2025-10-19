import { Logger } from './logger';
import fs from 'fs';
import path from 'path';

const logger = new Logger('SecurityLogger');

interface SecurityEvent {
  timestamp: Date;
  eventType: string;
  userId?: number;
  username?: string;
  chatId?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Specialized logger for security events and audit trail
 */
export class SecurityLogger {
  private static readonly LOG_DIR = path.join(process.cwd(), 'data', 'security-logs');
  private static readonly MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
  private static events: SecurityEvent[] = [];
  private static readonly MAX_IN_MEMORY = 1000;

  /**
   * Initialize security logger
   */
  static initialize(): void {
    // Ensure log directory exists
    if (!fs.existsSync(this.LOG_DIR)) {
      fs.mkdirSync(this.LOG_DIR, { recursive: true });
      logger.info('Security log directory created');
    }

    // Load recent events from file
    this.loadRecentEvents();
  }

  /**
   * Log a security event
   */
  static logEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      timestamp: new Date(),
      ...event,
    };

    // Add to in-memory storage
    this.events.push(fullEvent);

    // Trim in-memory storage if needed
    if (this.events.length > this.MAX_IN_MEMORY) {
      this.events = this.events.slice(-this.MAX_IN_MEMORY);
    }

    // Log to console based on severity
    const logMessage = `[${event.severity.toUpperCase()}] ${event.eventType}: ${event.description}`;
    const metadata = event.metadata ? ` | ${JSON.stringify(event.metadata)}` : '';

    switch (event.severity) {
      case 'critical':
        logger.error(`🚨 ${logMessage}${metadata}`);
        break;
      case 'high':
        logger.warn(`⚠️ ${logMessage}${metadata}`);
        break;
      case 'medium':
        logger.warn(`⚡ ${logMessage}${metadata}`);
        break;
      case 'low':
        logger.info(`ℹ️ ${logMessage}${metadata}`);
        break;
    }

    // Write to file asynchronously
    this.writeToFile(fullEvent).catch(err => {
      logger.error('Failed to write security event to file:', err);
    });
  }

  /**
   * Log unauthorized access attempt
   */
  static logUnauthorizedAccess(
    resource: string,
    userId: number,
    username?: string,
    chatId?: number
  ): void {
    this.logEvent({
      eventType: 'UNAUTHORIZED_ACCESS',
      userId,
      username,
      chatId,
      severity: 'high',
      description: `Unauthorized access attempt to ${resource}`,
      metadata: { resource },
    });
  }

  /**
   * Log rate limit violation
   */
  static logRateLimitViolation(
    command: string,
    userId: number,
    username?: string,
    chatId?: number
  ): void {
    this.logEvent({
      eventType: 'RATE_LIMIT_VIOLATION',
      userId,
      username,
      chatId,
      severity: 'medium',
      description: `Rate limit exceeded for ${command}`,
      metadata: { command },
    });
  }

  /**
   * Log input validation failure
   */
  static logValidationFailure(
    inputType: string,
    error: string,
    userId?: number,
    username?: string
  ): void {
    this.logEvent({
      eventType: 'VALIDATION_FAILURE',
      userId,
      username,
      severity: 'medium',
      description: `Input validation failed for ${inputType}: ${error}`,
      metadata: { inputType, error },
    });
  }

  /**
   * Log admin action
   */
  static logAdminAction(
    action: string,
    userId: number,
    username?: string,
    chatId?: number,
    metadata?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: 'ADMIN_ACTION',
      userId,
      username,
      chatId,
      severity: 'low',
      description: `Admin action: ${action}`,
      metadata,
    });
  }

  /**
   * Log suspicious activity
   */
  static logSuspiciousActivity(
    description: string,
    userId?: number,
    username?: string,
    chatId?: number,
    metadata?: Record<string, any>
  ): void {
    this.logEvent({
      eventType: 'SUSPICIOUS_ACTIVITY',
      userId,
      username,
      chatId,
      severity: 'high',
      description,
      metadata,
    });
  }

  /**
   * Get recent security events
   */
  static getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get events by severity
   */
  static getEventsBySeverity(severity: SecurityEvent['severity']): SecurityEvent[] {
    return this.events.filter(e => e.severity === severity);
  }

  /**
   * Get events by user
   */
  static getEventsByUser(userId: number): SecurityEvent[] {
    return this.events.filter(e => e.userId === userId);
  }

  /**
   * Write event to file
   */
  private static async writeToFile(event: SecurityEvent): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logFile = path.join(this.LOG_DIR, `security-${today}.log`);

    const logLine = JSON.stringify(event) + '\n';

    try {
      // Check file size before appending
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (stats.size > this.MAX_LOG_SIZE) {
          // Rotate log file
          const rotatedFile = path.join(
            this.LOG_DIR,
            `security-${today}-${Date.now()}.log`
          );
          fs.renameSync(logFile, rotatedFile);
          logger.info(`Security log rotated: ${rotatedFile}`);
        }
      }

      // Append to log file
      fs.appendFileSync(logFile, logLine, 'utf8');
    } catch (error) {
      logger.error('Error writing to security log file:', error);
    }
  }

  /**
   * Load recent events from today's log file
   */
  private static loadRecentEvents(): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.LOG_DIR, `security-${today}.log`);

      if (!fs.existsSync(logFile)) {
        return;
      }

      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.trim().split('\n').filter(l => l);

      // Load last MAX_IN_MEMORY events
      const recentLines = lines.slice(-this.MAX_IN_MEMORY);

      this.events = recentLines.map(line => {
        try {
          const event = JSON.parse(line);
          // Convert timestamp string back to Date
          event.timestamp = new Date(event.timestamp);
          return event;
        } catch (err) {
          logger.warn('Failed to parse security log line:', err);
          return null;
        }
      }).filter((e): e is SecurityEvent => e !== null);

      logger.info(`Loaded ${this.events.length} recent security events`);
    } catch (error) {
      logger.error('Error loading recent security events:', error);
    }
  }

  /**
   * Clean up old log files (older than 30 days)
   */
  static async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      if (!fs.existsSync(this.LOG_DIR)) {
        return;
      }

      const files = fs.readdirSync(this.LOG_DIR);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      let deletedCount = 0;

      for (const file of files) {
        if (!file.startsWith('security-') || !file.endsWith('.log')) {
          continue;
        }

        const filePath = path.join(this.LOG_DIR, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old security log files`);
      }
    } catch (error) {
      logger.error('Error cleaning up old security logs:', error);
    }
  }
}

export default SecurityLogger;
