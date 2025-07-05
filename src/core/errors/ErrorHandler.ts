import { BaseError, ValidationError } from './BaseError';
import { Logger } from '../../utils/logger';

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  executionTime?: number;
  metadata?: Record<string, unknown>;
}

export interface ErrorHandlerOptions {
  shouldLog?: boolean;
  shouldReport?: boolean;
  shouldNotify?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export class ErrorHandler {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  handleError(
    error: Error,
    context: ErrorContext = {},
    options: ErrorHandlerOptions = {}
  ): BaseError {
    const {
      shouldLog = true,
      shouldReport = true,
      shouldNotify = false,
      severity = 'medium',
    } = options;

    // Convert to BaseError if not already
    const baseError = this.normalizeError(error, context);

    // Log the error
    if (shouldLog) {
      this.logError(baseError, context, severity);
    }

    // Report for monitoring
    if (shouldReport) {
      this.reportError(baseError, context, severity);
    }

    // Send notifications for critical errors
    if (shouldNotify && severity === 'critical') {
      this.notifyError(baseError, context);
    }

    return baseError;
  }

  private normalizeError(error: Error, context: ErrorContext): BaseError {
    if (error instanceof BaseError) {
      // Enhance existing BaseError with additional context
      return this.enhanceBaseError(error, context);
    }

    // Convert generic Error to BaseError
    return this.convertToBaseError(error, context);
  }

  private enhanceBaseError(error: BaseError, context: ErrorContext): BaseError {
    // Create a new error with enhanced context
    const enhancedContext = {
      ...error.context,
      ...context,
      originalError: error.name,
      timestamp: new Date().toISOString(),
    };

    // Use the withContext method instead of direct constructor call
    const enhancedError = error.withContext(enhancedContext);

    return enhancedError;
  }

  private convertToBaseError(error: Error, context: ErrorContext): BaseError {

    const errorContext = {
      ...context,
      originalError: error.name,
      timestamp: new Date().toISOString(),
    };

    const baseError = new ValidationError(
      error.message || 'Unknown error occurred',
      errorContext,
      error
    );

    // Preserve original stack trace
    baseError.stack = error.stack;

    return baseError;
  }

  private logError(error: BaseError, context: ErrorContext, severity: string): void {
    const logData = {
      error: error.toJSON(),
      context,
      severity,
      timestamp: new Date().toISOString(),
    };

    switch (severity) {
      case 'critical':
        this.logger.error('Critical error occurred', logData);
        break;
      case 'high':
        this.logger.error('High severity error occurred', logData);
        break;
      case 'medium':
        this.logger.warn('Medium severity error occurred', logData);
        break;
      case 'low':
        this.logger.info('Low severity error occurred', logData);
        break;
      default:
        this.logger.warn('Error occurred', logData);
    }
  }

  private reportError(error: BaseError, context: ErrorContext, severity: string): void {
    // This would integrate with external monitoring services
    // For now, we'll just log the report
    this.logger.debug('Error reported for monitoring', {
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      },
      context,
      severity,
      timestamp: new Date().toISOString(),
    });
  }

  private notifyError(error: BaseError, context: ErrorContext): void {
    // This would integrate with alerting systems (email, Slack, etc.)
    // For now, we'll just log the notification
    this.logger.error('Critical error notification', {
      error: error.toJSON(),
      context,
      timestamp: new Date().toISOString(),
    });
  }

  categorizeError(error: Error): 'user' | 'system' | 'external' {
    if (error instanceof BaseError) {
      switch (error.statusCode) {
        case 400:
        case 401:
        case 403:
        case 404:
        case 409:
          return 'user';
        case 429:
        case 503:
          return 'external';
        default:
          return 'system';
      }
    }

    // For generic errors, try to categorize by message patterns
    const message = error.message.toLowerCase();

    if (message.includes('validation') || message.includes('invalid')) {
      return 'user';
    }

    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection')
    ) {
      return 'external';
    }

    return 'system';
  }

  isRetryableError(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.statusCode === 429 || error.statusCode === 503 || error.statusCode >= 500;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('rate limit')
    );
  }
}
