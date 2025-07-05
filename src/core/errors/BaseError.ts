// Base error class for the Marketing Post Generator MCP

export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  public readonly timestamp: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';

  constructor(
    message: string,
    public readonly context?: any,
    public readonly cause?: Error,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.severity = severity;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack,
      timestamp: this.timestamp,
      severity: this.severity,
      statusCode: this.statusCode,
    };
  }

  withContext(additionalContext: Record<string, unknown>): BaseError {
    const mergedContext = { ...this.context, ...additionalContext };
    const ErrorClass = this.constructor as typeof BaseError;
    const newError = new ErrorClass(this.message, mergedContext, this.cause, this.severity);
    newError.stack = this.stack;
    return newError;
  }

  isRetryable(): boolean {
    return this.statusCode >= 500 || this.statusCode === 429 || this.statusCode === 503;
  }

  isUserError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500 && this.statusCode !== 429;
  }

  isSystemError(): boolean {
    return this.statusCode >= 500;
  }
}

// Specific error types
export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class ContentGenerationError extends BaseError {
  readonly code = 'CONTENT_GENERATION_ERROR';
  readonly statusCode = 500;
}

export class StorageError extends BaseError {
  readonly code = 'STORAGE_ERROR';
  readonly statusCode = 500;
}

export class RateLimitError extends BaseError {
  readonly code = 'RATE_LIMIT_ERROR';
  readonly statusCode = 429;
}

export class ServiceUnavailableError extends BaseError {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly statusCode = 503;
}

export class ToolExecutionError extends BaseError {
  readonly code = 'TOOL_EXECUTION_ERROR';
  readonly statusCode = 500;

  constructor(
    message: string,
    public readonly toolName: string,
    cause?: Error
  ) {
    super(message, { toolName }, cause);
  }
}
