import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

const logger = new Logger('UsageAnalytics');

interface CommandUsage {
  command: string;
  count: number;
  lastUsed: string;
}

interface UserStats {
  userId: number;
  username?: string;
  totalCommands: number;
  commands: { [command: string]: number };
  firstSeen: string;
  lastSeen: string;
}

interface DailyStats {
  date: string;
  totalCommands: number;
  uniqueUsers: number;
  commands: { [command: string]: number };
}

interface AnalyticsData {
  totalCommands: number;
  totalUsers: number;
  commandStats: { [command: string]: CommandUsage };
  userStats: { [userId: number]: UserStats };
  dailyStats: DailyStats[];
  startDate: string;
}

/**
 * Usage analytics system to track bot usage patterns
 */
export class UsageAnalytics {
  private analyticsFile: string;
  private data: AnalyticsData;
  private saveInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.analyticsFile = path.join(process.cwd(), 'data', 'analytics.json');
    this.data = this.loadAnalytics();

    // Auto-save every 5 minutes
    this.saveInterval = setInterval(() => {
      this.saveAnalytics();
    }, 5 * 60 * 1000);
  }

  /**
   * Load analytics data from file
   */
  private loadAnalytics(): AnalyticsData {
    try {
      if (fs.existsSync(this.analyticsFile)) {
        const data = fs.readFileSync(this.analyticsFile, 'utf-8');
        const parsed = JSON.parse(data);
        logger.info(`Loaded analytics data: ${parsed.totalCommands} commands, ${parsed.totalUsers} users`);
        return parsed;
      }
    } catch (error) {
      logger.error('Failed to load analytics data:', error);
    }

    // Return empty analytics data
    return {
      totalCommands: 0,
      totalUsers: 0,
      commandStats: {},
      userStats: {},
      dailyStats: [],
      startDate: new Date().toISOString(),
    };
  }

  /**
   * Save analytics data to file
   */
  private saveAnalytics(): void {
    try {
      const dir = path.dirname(this.analyticsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.analyticsFile, JSON.stringify(this.data, null, 2), 'utf-8');
      logger.info('Analytics data saved');
    } catch (error) {
      logger.error('Failed to save analytics data:', error);
    }
  }

  /**
   * Track a command execution
   */
  trackCommand(command: string, userId: number, username?: string): void {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Update total commands
    this.data.totalCommands++;

    // Update command stats
    if (!this.data.commandStats[command]) {
      this.data.commandStats[command] = {
        command,
        count: 0,
        lastUsed: now.toISOString(),
      };
    }
    this.data.commandStats[command].count++;
    this.data.commandStats[command].lastUsed = now.toISOString();

    // Update user stats
    if (!this.data.userStats[userId]) {
      this.data.userStats[userId] = {
        userId,
        username,
        totalCommands: 0,
        commands: {},
        firstSeen: now.toISOString(),
        lastSeen: now.toISOString(),
      };
      this.data.totalUsers++;
    }

    const userStat = this.data.userStats[userId];
    userStat.totalCommands++;
    userStat.lastSeen = now.toISOString();
    if (username) {
      userStat.username = username;
    }

    if (!userStat.commands[command]) {
      userStat.commands[command] = 0;
    }
    userStat.commands[command]++;

    // Update daily stats
    let todayStats = this.data.dailyStats.find(s => s.date === todayStr);
    if (!todayStats) {
      todayStats = {
        date: todayStr,
        totalCommands: 0,
        uniqueUsers: 0,
        commands: {},
      };
      this.data.dailyStats.push(todayStats);
    }

    todayStats.totalCommands++;
    if (!todayStats.commands[command]) {
      todayStats.commands[command] = 0;
    }
    todayStats.commands[command]++;

    // Update unique users for today
    const uniqueUsersToday = new Set(
      Object.values(this.data.userStats)
        .filter(u => u.lastSeen.startsWith(todayStr))
        .map(u => u.userId)
    );
    todayStats.uniqueUsers = uniqueUsersToday.size;

    // Keep only last 90 days of daily stats
    if (this.data.dailyStats.length > 90) {
      this.data.dailyStats = this.data.dailyStats.slice(-90);
    }
  }

  /**
   * Get overall statistics
   */
  getOverallStats(): {
    totalCommands: number;
    totalUsers: number;
    topCommands: { command: string; count: number }[];
    topUsers: { userId: number; username?: string; commandCount: number }[];
    startDate: string;
  } {
    const topCommands = Object.values(this.data.commandStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(c => ({ command: c.command, count: c.count }));

    const topUsers = Object.values(this.data.userStats)
      .sort((a, b) => b.totalCommands - a.totalCommands)
      .slice(0, 10)
      .map(u => ({ userId: u.userId, username: u.username, commandCount: u.totalCommands }));

    return {
      totalCommands: this.data.totalCommands,
      totalUsers: this.data.totalUsers,
      topCommands,
      topUsers,
      startDate: this.data.startDate,
    };
  }

  /**
   * Get daily statistics for the last N days
   */
  getDailyStats(days: number = 7): DailyStats[] {
    return this.data.dailyStats.slice(-days);
  }

  /**
   * Get statistics for a specific user
   */
  getUserStats(userId: number): UserStats | null {
    return this.data.userStats[userId] || null;
  }

  /**
   * Get today's statistics
   */
  getTodayStats(): DailyStats | null {
    const todayStr = new Date().toISOString().split('T')[0];
    return this.data.dailyStats.find(s => s.date === todayStr) || null;
  }

  /**
   * Generate analytics report
   */
  generateReport(days: number = 7): string {
    const overall = this.getOverallStats();
    const dailyStats = this.getDailyStats(days);
    const today = this.getTodayStats();

    let report = `📊 *Usage Analytics Report*\n\n`;

    // Overall stats
    const daysSinceStart = Math.floor(
      (Date.now() - new Date(overall.startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    report += `*Overall Statistics*\n`;
    report += `📅 Tracking since: ${new Date(overall.startDate).toLocaleDateString()} (${daysSinceStart} days)\n`;
    report += `📈 Total commands: ${overall.totalCommands.toLocaleString()}\n`;
    report += `👥 Total users: ${overall.totalUsers.toLocaleString()}\n`;
    report += `📊 Avg commands/day: ${Math.round(overall.totalCommands / Math.max(daysSinceStart, 1))}\n\n`;

    // Today's stats
    if (today) {
      report += `*Today's Activity*\n`;
      report += `📈 Commands: ${today.totalCommands}\n`;
      report += `👥 Active users: ${today.uniqueUsers}\n\n`;
    }

    // Top commands
    report += `*Top Commands*\n`;
    overall.topCommands.slice(0, 5).forEach((cmd, i) => {
      const percentage = Math.round((cmd.count / overall.totalCommands) * 100);
      report += `${i + 1}. /${cmd.command}: ${cmd.count} (${percentage}%)\n`;
    });
    report += `\n`;

    // Last 7 days trend
    if (dailyStats.length > 0) {
      report += `*Last ${days} Days Trend*\n`;
      dailyStats.forEach(day => {
        const date = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        report += `${date}: ${day.totalCommands} cmds, ${day.uniqueUsers} users\n`;
      });
    }

    return report;
  }

  /**
   * Cleanup old data
   */
  cleanup(daysToKeep: number = 90): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString();

    // Remove old daily stats
    this.data.dailyStats = this.data.dailyStats.filter(s => s.date >= cutoffStr.split('T')[0]);

    // Remove inactive users (no activity in daysToKeep)
    const activeUserIds = Object.keys(this.data.userStats)
      .map(Number)
      .filter(userId => {
        const user = this.data.userStats[userId];
        return user.lastSeen >= cutoffStr;
      });

    const removedUsers = Object.keys(this.data.userStats).length - activeUserIds.length;

    if (removedUsers > 0) {
      const newUserStats: { [userId: number]: UserStats } = {};
      activeUserIds.forEach(userId => {
        newUserStats[userId] = this.data.userStats[userId];
      });
      this.data.userStats = newUserStats;
      this.data.totalUsers = activeUserIds.length;
      logger.info(`Cleanup: Removed ${removedUsers} inactive users`);
    }

    this.saveAnalytics();
  }

  /**
   * Stop the analytics service
   */
  stop(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    this.saveAnalytics();
    logger.info('Usage analytics stopped');
  }
}

// Export singleton instance
export default new UsageAnalytics();
