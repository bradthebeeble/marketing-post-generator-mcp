// Base error class for the Marketing Post Generator MCP

export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly context?: any,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
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
