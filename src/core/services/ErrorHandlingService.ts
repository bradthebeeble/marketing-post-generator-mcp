import { ErrorHandler } from '../errors/ErrorHandler';
import { ErrorReporter } from '../errors/ErrorReporter';
import { createLogger, Logger } from '../../utils/logger';
import { ServerConfig } from '../../types';

export class ErrorHandlingService {
  private errorHandler: ErrorHandler;
  private errorReporter: ErrorReporter;
  private logger: Logger;
  
  constructor(config: ServerConfig['errorHandling']) {
    this.logger = createLogger('ErrorHandlingService');
    
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
      const metrics = this.errorReporter.getMetrics();
      const recentCriticalErrors = this.errorReporter.getRecentErrors(10)
        .filter(error => error.severity === 'critical');
      
      // Consider unhealthy if too many critical errors in recent history
      return recentCriticalErrors.length < 5;
    } catch (error) {
      this.logger.error('Health check failed', { error: error instanceof Error ? error.message : error });
      return false;
    }
  }

  // Get service metrics
  getMetrics() {
    return {
      errorMetrics: this.errorReporter.getMetrics(),
      summaryReport: this.errorReporter.generateSummaryReport(),
      healthStatus: this.isHealthy(),
    };
  }
}