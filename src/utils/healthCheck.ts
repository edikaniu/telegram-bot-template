import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';

const logger = new Logger('HealthCheck');

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      timestamp: string;
    };
  };
  uptime: number;
  timestamp: string;
}

/**
 * Health check system to monitor bot status and dependencies
 */
export class HealthCheck {
  private startTime: number;
  private lastCheckResults: HealthCheckResult | null = null;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Get bot uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Check if data directory is accessible
   */
  private checkDataDirectory(): { status: 'pass' | 'fail'; message?: string } {
    try {
      const dataDir = path.join(process.cwd(), 'data');

      // Check if directory exists
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        return { status: 'pass', message: 'Data directory created' };
      }

      // Check if writable
      const testFile = path.join(dataDir, '.healthcheck');
      fs.writeFileSync(testFile, 'test', 'utf-8');
      fs.unlinkSync(testFile);

      return { status: 'pass' };
    } catch (error) {
      return {
        status: 'fail',
        message: `Data directory not accessible: ${String(error)}`
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemoryUsage(): { status: 'pass' | 'warn' | 'fail'; message?: string } {
    try {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const usagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

      if (usagePercent > 90) {
        return {
          status: 'fail',
          message: `Critical memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent}%)`
        };
      } else if (usagePercent > 75) {
        return {
          status: 'warn',
          message: `High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent}%)`
        };
      }

      return {
        status: 'pass',
        message: `${heapUsedMB}MB / ${heapTotalMB}MB (${usagePercent}%)`
      };
    } catch (error) {
      return {
        status: 'fail',
        message: `Memory check failed: ${String(error)}`
      };
    }
  }

  /**
   * Check critical environment variables
   */
  private checkEnvironmentVariables(): { status: 'pass' | 'fail'; message?: string } {
    const requiredVars = ['TELEGRAM_BOT_TOKEN', 'GEMINI_API_KEY'];
    const missing: string[] = [];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      return {
        status: 'fail',
        message: `Missing environment variables: ${missing.join(', ')}`
      };
    }

    return { status: 'pass' };
  }

  /**
   * Check if critical files exist
   */
  private checkCriticalFiles(): { status: 'pass' | 'warn' | 'fail'; message?: string } {
    const criticalFiles = [
      'package.json',
      'tsconfig.json',
      '.env',
    ];

    const missing: string[] = [];
    for (const file of criticalFiles) {
      if (!fs.existsSync(path.join(process.cwd(), file))) {
        missing.push(file);
      }
    }

    if (missing.includes('.env')) {
      return {
        status: 'fail',
        message: `.env file missing`
      };
    } else if (missing.length > 0) {
      return {
        status: 'warn',
        message: `Non-critical files missing: ${missing.join(', ')}`
      };
    }

    return { status: 'pass' };
  }

  /**
   * Check Node.js version
   */
  private checkNodeVersion(): { status: 'pass' | 'warn'; message?: string } {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0], 10);

    if (majorVersion < 18) {
      return {
        status: 'warn',
        message: `Node.js ${version} is outdated, recommend v18+`
      };
    }

    return {
      status: 'pass',
      message: `Node.js ${version}`
      };
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<HealthCheckResult> {
    logger.info('Running health checks...');

    const checks = {
      dataDirectory: this.checkDataDirectory(),
      memoryUsage: this.checkMemoryUsage(),
      environmentVariables: this.checkEnvironmentVariables(),
      criticalFiles: this.checkCriticalFiles(),
      nodeVersion: this.checkNodeVersion(),
    };

    // Add timestamp to each check
    const checksWithTimestamp = Object.entries(checks).reduce((acc, [key, value]) => {
      acc[key] = {
        ...value,
        timestamp: new Date().toISOString(),
      };
      return acc;
    }, {} as HealthCheckResult['checks']);

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    const hasFailures = Object.values(checks).some(check => check.status === 'fail');
    const hasWarnings = Object.values(checks).some(check => check.status === 'warn');

    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'degraded';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      checks: checksWithTimestamp,
      uptime: this.getUptime(),
      timestamp: new Date().toISOString(),
    };

    this.lastCheckResults = result;

    // Log results
    const statusEmoji = overallStatus === 'healthy' ? '✅' : overallStatus === 'degraded' ? '⚠️' : '❌';
    logger.info(`${statusEmoji} Health check complete: ${overallStatus.toUpperCase()}`);

    Object.entries(checks).forEach(([key, value]) => {
      const emoji = value.status === 'pass' ? '✓' : value.status === 'warn' ? '⚠' : '✗';
      const msg = value.message ? ` - ${value.message}` : '';
      logger.info(`  ${emoji} ${key}${msg}`);
    });

    return result;
  }

  /**
   * Get last health check results
   */
  getLastCheckResults(): HealthCheckResult | null {
    return this.lastCheckResults;
  }

  /**
   * Generate health report as formatted text
   */
  generateHealthReport(result?: HealthCheckResult): string {
    const data = result || this.lastCheckResults;

    if (!data) {
      return '❌ No health check results available. Run /health to check bot status.';
    }

    const statusEmoji = data.status === 'healthy' ? '✅' : data.status === 'degraded' ? '⚠️' : '❌';
    const uptimeHours = Math.floor(data.uptime / 3600);
    const uptimeMinutes = Math.floor((data.uptime % 3600) / 60);

    let report = `${statusEmoji} *Bot Health Status: ${data.status.toUpperCase()}*\n\n`;
    report += `⏱ Uptime: ${uptimeHours}h ${uptimeMinutes}m\n\n`;
    report += `*System Checks:*\n`;

    Object.entries(data.checks).forEach(([key, value]) => {
      const emoji = value.status === 'pass' ? '✅' : value.status === 'warn' ? '⚠️' : '❌';
      const name = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      const msg = value.message ? `\n  _${value.message}_` : '';
      report += `${emoji} ${name}${msg}\n`;
    });

    report += `\n_Last check: ${new Date(data.timestamp).toLocaleString()}_`;

    return report;
  }
}

// Export singleton instance
export default new HealthCheck();
