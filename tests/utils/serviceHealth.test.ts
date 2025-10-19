import { ServiceHealthMonitor, ServiceStatus } from '../../src/utils/serviceHealth';

describe('ServiceHealthMonitor', () => {
  let monitor: ServiceHealthMonitor;

  beforeEach(() => {
    monitor = new ServiceHealthMonitor();
  });

  describe('registerService', () => {
    test('should register a new service', () => {
      monitor.registerService('test-service');
      expect(monitor.getServiceStatus('test-service')).toBe(ServiceStatus.HEALTHY);
    });

    test('should not re-register existing service', () => {
      monitor.registerService('test-service');
      monitor.recordFailure('test-service', 'error');
      monitor.registerService('test-service');
      // Status should remain degraded, not reset to healthy
      expect(monitor.getServiceStatus('test-service')).toBe(ServiceStatus.DEGRADED);
    });
  });

  describe('recordSuccess', () => {
    test('should mark service as healthy', () => {
      monitor.registerService('test-service');
      monitor.recordSuccess('test-service');
      expect(monitor.getServiceStatus('test-service')).toBe(ServiceStatus.HEALTHY);
    });

    test('should reset consecutive failures', () => {
      monitor.registerService('test-service');
      monitor.recordFailure('test-service', 'error 1');
      monitor.recordFailure('test-service', 'error 2');
      monitor.recordSuccess('test-service');
      expect(monitor.getServiceStatus('test-service')).toBe(ServiceStatus.HEALTHY);
    });
  });

  describe('recordFailure', () => {
    test('should mark service as degraded after 1 failure', () => {
      monitor.registerService('test-service');
      monitor.recordFailure('test-service', 'error');
      expect(monitor.getServiceStatus('test-service')).toBe(ServiceStatus.DEGRADED);
    });

    test('should mark service as unavailable after 3 failures', () => {
      monitor.registerService('test-service');
      monitor.recordFailure('test-service', 'error 1');
      monitor.recordFailure('test-service', 'error 2');
      monitor.recordFailure('test-service', 'error 3');
      expect(monitor.getServiceStatus('test-service')).toBe(ServiceStatus.UNAVAILABLE);
    });

    test('should auto-register service if not registered', () => {
      monitor.recordFailure('new-service', 'error');
      expect(monitor.getServiceStatus('new-service')).toBe(ServiceStatus.DEGRADED);
    });
  });

  describe('isServiceAvailable', () => {
    test('should return true for healthy service', () => {
      monitor.registerService('test-service');
      expect(monitor.isServiceAvailable('test-service')).toBe(true);
    });

    test('should return true for degraded service', () => {
      monitor.registerService('test-service');
      monitor.recordFailure('test-service', 'error');
      expect(monitor.isServiceAvailable('test-service')).toBe(true);
    });

    test('should return false for unavailable service', () => {
      monitor.registerService('test-service');
      monitor.recordFailure('test-service', 'error 1');
      monitor.recordFailure('test-service', 'error 2');
      monitor.recordFailure('test-service', 'error 3');
      expect(monitor.isServiceAvailable('test-service')).toBe(false);
    });
  });

  describe('isServiceHealthy', () => {
    test('should return true only for healthy status', () => {
      monitor.registerService('test-service');
      expect(monitor.isServiceHealthy('test-service')).toBe(true);

      monitor.recordFailure('test-service', 'error');
      expect(monitor.isServiceHealthy('test-service')).toBe(false);
    });
  });

  describe('resetService', () => {
    test('should reset service to healthy status', () => {
      monitor.registerService('test-service');
      monitor.recordFailure('test-service', 'error 1');
      monitor.recordFailure('test-service', 'error 2');
      monitor.recordFailure('test-service', 'error 3');

      expect(monitor.resetService('test-service')).toBe(true);
      expect(monitor.getServiceStatus('test-service')).toBe(ServiceStatus.HEALTHY);
    });

    test('should return false for non-existent service', () => {
      expect(monitor.resetService('non-existent')).toBe(false);
    });
  });

  describe('generateHealthReport', () => {
    test('should generate report with no services', () => {
      const report = monitor.generateHealthReport();
      expect(report).toContain('No services registered');
    });

    test('should generate report with services', () => {
      monitor.registerService('service1');
      monitor.registerService('service2');
      monitor.recordFailure('service2', 'test error');

      const report = monitor.generateHealthReport();
      expect(report).toContain('service1');
      expect(report).toContain('service2');
      expect(report).toContain('healthy');
      expect(report).toContain('degraded');
    });
  });
});
