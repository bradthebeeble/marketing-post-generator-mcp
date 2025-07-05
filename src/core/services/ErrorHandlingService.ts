import { ErrorHandler } from '../errors/ErrorHandler';
import { ErrorReporter, ErrorMetrics } from '../errors/ErrorReporter';
import { createLogger, Logger } from '../../utils/logger';
import { ServerConfig } from '../../types';

export class ErrorHandlingService {
  private readonly errorHandler: ErrorHandler;
  private readonly errorReporter: ErrorReporter;
  private readonly logger: Logger;

  constructor(config: ServerConfig['errorHandling']) {
    this.logger = createLogger({ level: 'info', format: 'json' });

    // Initialize error reporter with config
    this.errorReporter = new ErrorReporter(this.logger, {
      maxRecentErrors: config.maxRecentErrors,
      enableStackTrace: config.enableStackTrace,
      excludeStackTraceForCodes: config.excludeStackTraceForCodes,
    });

    // Initialize error handler
    this.errorHandler = new ErrorHandler(this.logger);
  }

  getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }

  getErrorReporter(): ErrorReporter {
    return this.errorReporter;
  }

  getLogger(): Logger {
    return this.logger;
  }

  // Health check method
  isHealthy(): boolean {
    try {
      // Basic health checks
      const recentCriticalErrors = this.errorReporter
        .getRecentErrors(10)
        .filter((error) => error.severity === 'critical');

      // Consider unhealthy if too many critical errors in recent history
      return recentCriticalErrors.length < 5;
    } catch (error: unknown) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  // Get service metrics
  getMetrics(): {
    errorMetrics: ErrorMetrics;
    summaryReport: ReturnType<ErrorReporter['generateSummaryReport']>;
    healthStatus: boolean;
  } {
    return {
      errorMetrics: this.errorReporter.getMetrics(),
      summaryReport: this.errorReporter.generateSummaryReport(),
      healthStatus: this.isHealthy(),
    };
  }
}
