import { Logger } from './logger';

const logger = new Logger('ServiceHealth');

/**
 * Service status tracking
 */
export enum ServiceStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNAVAILABLE = 'unavailable',
}

interface ServiceState {
  status: ServiceStatus;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
}

/**
 * Circuit breaker pattern for service degradation
 */
export class ServiceHealthMonitor {
  private services: Map<string, ServiceState> = new Map();
  private readonly maxConsecutiveFailures = 3;
  private readonly recoveryCheckInterval = 60000; // 1 minute

  /**
   * Register a service for monitoring
   */
  registerService(serviceName: string): void {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, {
        status: ServiceStatus.HEALTHY,
        lastCheck: new Date(),
        consecutiveFailures: 0,
      });
      logger.info(`Service registered: ${serviceName}`);
    }
  }

  /**
   * Record a successful service call
   */
  recordSuccess(serviceName: string): void {
    const service = this.services.get(serviceName);
    if (service) {
      const wasUnhealthy = service.status !== ServiceStatus.HEALTHY;

      service.status = ServiceStatus.HEALTHY;
      service.consecutiveFailures = 0;
      service.lastCheck = new Date();
      delete service.lastError;

      if (wasUnhealthy) {
        logger.info(`Service recovered: ${serviceName}`);
      }
    }
  }

  /**
   * Record a service failure
   */
  recordFailure(serviceName: string, error: string): void {
    let service = this.services.get(serviceName);

    if (!service) {
      this.registerService(serviceName);
      service = this.services.get(serviceName)!;
    }

    service.consecutiveFailures++;
    service.lastCheck = new Date();
    service.lastError = error;

    // Update status based on consecutive failures
    if (service.consecutiveFailures >= this.maxConsecutiveFailures) {
      service.status = ServiceStatus.UNAVAILABLE;
      logger.error(`Service unavailable: ${serviceName} (${service.consecutiveFailures} failures)`);
    } else {
      service.status = ServiceStatus.DEGRADED;
      logger.warn(`Service degraded: ${serviceName} (${service.consecutiveFailures} failures)`);
    }
  }

  /**
   * Get service status
   */
  getServiceStatus(serviceName: string): ServiceStatus {
    const service = this.services.get(serviceName);
    return service ? service.status : ServiceStatus.HEALTHY;
  }

  /**
   * Check if service is available
   */
  isServiceAvailable(serviceName: string): boolean {
    const status = this.getServiceStatus(serviceName);
    return status !== ServiceStatus.UNAVAILABLE;
  }

  /**
   * Check if service is healthy
   */
  isServiceHealthy(serviceName: string): boolean {
    const status = this.getServiceStatus(serviceName);
    return status === ServiceStatus.HEALTHY;
  }

  /**
   * Get all service states
   */
  getAllServiceStates(): Map<string, ServiceState> {
    return new Map(this.services);
  }

  /**
   * Generate health report
   */
  generateHealthReport(): string {
    const services = Array.from(this.services.entries());

    if (services.length === 0) {
      return '📊 *Service Health*\n\nNo services registered.';
    }

    let report = '📊 *Service Health Status*\n\n';

    for (const [name, state] of services) {
      const statusEmoji =
        state.status === ServiceStatus.HEALTHY ? '✅' :
        state.status === ServiceStatus.DEGRADED ? '⚠️' : '❌';

      const timeSinceCheck = Date.now() - state.lastCheck.getTime();
      const minutesAgo = Math.floor(timeSinceCheck / 60000);

      report += `${statusEmoji} *${name}*\n`;
      report += `  Status: ${state.status}\n`;
      report += `  Failures: ${state.consecutiveFailures}\n`;
      report += `  Last check: ${minutesAgo}m ago\n`;

      if (state.lastError) {
        report += `  Error: ${state.lastError.substring(0, 50)}...\n`;
      }

      report += '\n';
    }

    return report;
  }

  /**
   * Reset a service status (for manual recovery)
   */
  resetService(serviceName: string): boolean {
    const service = this.services.get(serviceName);
    if (service) {
      service.status = ServiceStatus.HEALTHY;
      service.consecutiveFailures = 0;
      service.lastCheck = new Date();
      delete service.lastError;
      logger.info(`Service manually reset: ${serviceName}`);
      return true;
    }
    return false;
  }
}

/**
 * Graceful degradation wrapper for async operations
 */
export async function withGracefulDegradation<T>(
  serviceName: string,
  operation: () => Promise<T>,
  fallback: T | (() => T),
  monitor: ServiceHealthMonitor
): Promise<T> {
  // Check if service is available
  if (!monitor.isServiceAvailable(serviceName)) {
    logger.warn(`Service ${serviceName} unavailable, using fallback`);
    return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
  }

  try {
    const result = await operation();
    monitor.recordSuccess(serviceName);
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    monitor.recordFailure(serviceName, errorMsg);

    logger.warn(`Service ${serviceName} failed, using fallback: ${errorMsg}`);
    return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
  }
}

// Export singleton instance
export default new ServiceHealthMonitor();
