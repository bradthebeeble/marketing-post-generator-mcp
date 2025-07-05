import {
  ToolExecutionError,
  ContentGenerationError,
  ServiceUnavailableError,
  NetworkError,
  TimeoutError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  ConfigurationError,
} from './BaseError';
import { ErrorHandler } from './ErrorHandler';
import { Logger } from '../../utils/logger';

export interface McpToolContext {
  toolName: string;
  arguments: Record<string, unknown>;
  requestId?: string;
  userId?: string;
}

export interface McpPromptContext {
  promptName: string;
  arguments: Record<string, unknown>;
  requestId?: string;
  userId?: string;
}

export interface McpErrorConfig {
  criticalTools: string[];
  criticalPrompts: string[];
  errorTypeMappings: Record<string, string>;
  severityOverrides: Record<string, 'low' | 'medium' | 'high' | 'critical'>;
}

export interface ErrorClassification {
  isNetworkError: boolean;
  isTimeoutError: boolean;
  isAuthError: boolean;
  isValidationError: boolean;
  isConfigurationError: boolean;
  originalError: Error;
}

export class McpErrorWrapper {
  private readonly errorHandler: ErrorHandler;
  private readonly logger: Logger;
  private config: McpErrorConfig;

  constructor(errorHandler: ErrorHandler, logger: Logger, config?: Partial<McpErrorConfig>) {
    this.errorHandler = errorHandler;
    this.logger = logger;
    this.config = {
      criticalTools: ['generate_content', 'save_post', 'publish_post'],
      criticalPrompts: ['content_generation', 'post_creation'],
      errorTypeMappings: {
        ENOTFOUND: 'NetworkError',
        ECONNREFUSED: 'NetworkError',
        ECONNRESET: 'NetworkError',
        ETIMEDOUT: 'TimeoutError',
        TIMEOUT: 'TimeoutError',
        UNAUTHORIZED: 'AuthenticationError',
        FORBIDDEN: 'AuthorizationError',
        VALIDATION_FAILED: 'ValidationError',
        INVALID_INPUT: 'ValidationError',
        CONFIG_ERROR: 'ConfigurationError',
      },
      severityOverrides: {},
      ...config,
    };
  }

  async wrapToolExecution<T>(toolFunction: () => Promise<T>, context: McpToolContext): Promise<T> {
    const startTime = Date.now();

    try {
      this.logger.debug('Tool execution started', {
        toolName: context.toolName,
        arguments: context.arguments,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      });

      const result = await toolFunction();

      const executionTime = Date.now() - startTime;
      this.logger.info('Tool execution completed', {
        toolName: context.toolName,
        executionTime,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Convert to typed error first
      const typedError =
        error instanceof Error
          ? this.convertToTypedError(error, { ...context, executionTime })
          : new Error(String(error));

      // Create tool execution error
      const toolError = new ToolExecutionError(
        `Tool '${context.toolName}' execution failed: ${typedError.message}`,
        context.toolName,
        typedError
      );

      // Handle the error with context
      const handledError = this.errorHandler.handleError(
        toolError,
        {
          ...context,
          executionTime,
          operation: 'tool_execution',
        },
        {
          severity: this.determineSeverity(typedError, context),
          shouldNotify: this.shouldNotifyForTool(context.toolName),
        }
      );

      throw handledError;
    }
  }

  async wrapPromptExecution<T>(
    promptFunction: () => Promise<T>,
    context: McpPromptContext
  ): Promise<T> {
    const startTime = Date.now();

    try {
      this.logger.debug('Prompt execution started', {
        promptName: context.promptName,
        arguments: context.arguments,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      });

      const result = await promptFunction();

      const executionTime = Date.now() - startTime;
      this.logger.info('Prompt execution completed', {
        promptName: context.promptName,
        executionTime,
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Convert to typed error first
      const typedError =
        error instanceof Error
          ? this.convertToTypedError(error, { ...context, executionTime })
          : new Error(String(error));

      // Create content generation error for prompts
      const promptError = new ContentGenerationError(
        `Prompt '${context.promptName}' execution failed: ${typedError.message}`,
        {
          ...context,
          executionTime,
        },
        typedError
      );

      // Handle the error with context
      const handledError = this.errorHandler.handleError(
        promptError,
        {
          ...context,
          executionTime,
          operation: 'prompt_execution',
        },
        {
          severity: this.determineSeverity(typedError, context),
          shouldNotify: this.shouldNotifyForPrompt(context.promptName),
        }
      );

      throw handledError;
    }
  }

  async wrapWithRetry<T>(
    operation: () => Promise<T>,
    context: { operationName: string; requestId?: string },
    retryOptions: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      shouldRetry?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      shouldRetry = (error) => this.errorHandler.isRetryableError(error),
    } = retryOptions;

    let lastError: Error = new Error('No attempts made');

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        if (attempt > 1) {
          this.logger.info('Retrying operation', {
            operationName: context.operationName,
            attempt,
            maxRetries: maxRetries + 1,
            requestId: context.requestId,
          });
        }

        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt <= maxRetries && shouldRetry(lastError)) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

          this.logger.warn('Operation failed, retrying', {
            operationName: context.operationName,
            attempt,
            error: lastError.message,
            retryDelay: delay,
            requestId: context.requestId,
          });

          await this.delay(delay);
          continue;
        }

        // Max retries reached or error is not retryable
        const finalError = new ServiceUnavailableError(
          `Operation '${context.operationName}' failed after ${attempt} attempts: ${lastError.message}`,
          {
            ...context,
            attempts: attempt,
            finalError: lastError.message,
          },
          lastError
        );

        throw this.errorHandler.handleError(finalError, context, {
          severity: 'high',
          shouldNotify: attempt > maxRetries,
        });
      }
    }

    throw lastError;
  }

  private determineSeverity(
    error: unknown,
    context: McpToolContext | McpPromptContext
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Check for severity overrides based on context
    const contextKey = 'toolName' in context ? context.toolName : context.promptName;
    if (this.config.severityOverrides[contextKey]) {
      return this.config.severityOverrides[contextKey];
    }

    if (error instanceof Error) {
      // Use proper error type checking instead of string matching
      const classification = this.classifyError(error);

      // Authentication/authorization errors are high severity
      if (classification.isAuthError) {
        return 'high';
      }

      // Validation errors are low severity
      if (classification.isValidationError) {
        return 'low';
      }

      // Network errors are medium severity by default
      if (classification.isNetworkError) {
        return 'medium';
      }

      // Timeout errors are medium severity
      if (classification.isTimeoutError) {
        return 'medium';
      }

      // Configuration errors are high severity
      if (classification.isConfigurationError) {
        return 'high';
      }
    }

    // Critical tools/prompts should have higher severity
    if ('toolName' in context && this.config.criticalTools.includes(context.toolName)) {
      return 'high';
    }

    if ('promptName' in context && this.config.criticalPrompts.includes(context.promptName)) {
      return 'high';
    }

    return 'medium';
  }

  private shouldNotifyForTool(toolName: string): boolean {
    return this.config.criticalTools.includes(toolName);
  }

  private shouldNotifyForPrompt(promptName: string): boolean {
    return this.config.criticalPrompts.includes(promptName);
  }

  private classifyError(error: Error): ErrorClassification {
    // Check if error is already a specific BaseError type
    if (error instanceof NetworkError) {
      return {
        isNetworkError: true,
        isTimeoutError: false,
        isAuthError: false,
        isValidationError: false,
        isConfigurationError: false,
        originalError: error,
      };
    }

    if (error instanceof TimeoutError) {
      return {
        isNetworkError: false,
        isTimeoutError: true,
        isAuthError: false,
        isValidationError: false,
        isConfigurationError: false,
        originalError: error,
      };
    }

    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        isNetworkError: false,
        isTimeoutError: false,
        isAuthError: true,
        isValidationError: false,
        isConfigurationError: false,
        originalError: error,
      };
    }

    if (error instanceof ValidationError) {
      return {
        isNetworkError: false,
        isTimeoutError: false,
        isAuthError: false,
        isValidationError: true,
        isConfigurationError: false,
        originalError: error,
      };
    }

    if (error instanceof ConfigurationError) {
      return {
        isNetworkError: false,
        isTimeoutError: false,
        isAuthError: false,
        isValidationError: false,
        isConfigurationError: true,
        originalError: error,
      };
    }

    // For standard Error types, use error code and message patterns
    const errorCode = (error as any).code || '';
    const errorMessage = error.message.toLowerCase();

    // Check error codes first (more reliable)
    for (const [code, errorType] of Object.entries(this.config.errorTypeMappings)) {
      if (errorCode === code) {
        return this.createClassificationFromType(errorType, error);
      }
    }

    // Fallback to message pattern matching (less reliable)
    const isNetworkError = /network|connection|dns|host|enotfound|econnrefused|econnreset/.test(
      errorMessage
    );
    const isTimeoutError = /timeout|etimedout/.test(errorMessage);
    const isAuthError =
      /auth|unauthorized|forbidden|permission|access denied|invalid.*token|expired.*token/.test(
        errorMessage
      );
    const isValidationError = /validation|invalid|malformed|bad request|schema/.test(errorMessage);
    const isConfigurationError =
      /config|configuration|setup|initialization|missing.*key|invalid.*setting/.test(errorMessage);

    return {
      isNetworkError,
      isTimeoutError,
      isAuthError,
      isValidationError,
      isConfigurationError,
      originalError: error,
    };
  }

  private createClassificationFromType(errorType: string, error: Error): ErrorClassification {
    const classification = {
      isNetworkError: false,
      isTimeoutError: false,
      isAuthError: false,
      isValidationError: false,
      isConfigurationError: false,
      originalError: error,
    };

    switch (errorType) {
      case 'NetworkError':
        classification.isNetworkError = true;
        break;
      case 'TimeoutError':
        classification.isTimeoutError = true;
        break;
      case 'AuthenticationError':
      case 'AuthorizationError':
        classification.isAuthError = true;
        break;
      case 'ValidationError':
        classification.isValidationError = true;
        break;
      case 'ConfigurationError':
        classification.isConfigurationError = true;
        break;
    }

    return classification;
  }

  updateConfig(config: Partial<McpErrorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): McpErrorConfig {
    return { ...this.config };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convert a standard error to an appropriate BaseError type based on classification
   */
  private convertToTypedError(error: Error, context?: any): Error {
    // If it's already a BaseError, return as is
    if (
      error instanceof ToolExecutionError ||
      error instanceof ContentGenerationError ||
      error instanceof ServiceUnavailableError ||
      error instanceof NetworkError ||
      error instanceof TimeoutError ||
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError ||
      error instanceof ValidationError ||
      error instanceof ConfigurationError
    ) {
      return error;
    }

    const classification = this.classifyError(error);

    if (classification.isNetworkError) {
      return new NetworkError(error.message, context, error);
    }

    if (classification.isTimeoutError) {
      return new TimeoutError(error.message, context, error);
    }

    if (classification.isAuthError) {
      // Determine if it's authentication or authorization based on message
      if (
        error.message.toLowerCase().includes('unauthorized') ||
        error.message.toLowerCase().includes('invalid') ||
        error.message.toLowerCase().includes('expired')
      ) {
        return new AuthenticationError(error.message, context, error);
      }
      return new AuthorizationError(error.message, context, error);
    }

    if (classification.isValidationError) {
      return new ValidationError(error.message, context, error);
    }

    if (classification.isConfigurationError) {
      return new ConfigurationError(error.message, context, error);
    }

    // Return the original error if no specific type matches
    return error;
  }
}

// Helper functions for easy usage
export function createMcpErrorWrapper(
  errorHandler: ErrorHandler,
  logger: Logger,
  config?: Partial<McpErrorConfig>
): McpErrorWrapper {
  return new McpErrorWrapper(errorHandler, logger, config);
}

// Generic decorator factory to reduce duplication
function createErrorHandlingDecorator(
  errorWrapper: McpErrorWrapper,
  type: 'tool' | 'prompt',
  name: string
) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context = {
        [type === 'tool' ? 'toolName' : 'promptName']: name,
        arguments: args.length > 0 ? args[0] : {},
        requestId: (this as any).requestId,
        userId: (this as any).userId,
      };

      const wrapMethod =
        type === 'tool'
          ? errorWrapper.wrapToolExecution.bind(errorWrapper)
          : errorWrapper.wrapPromptExecution.bind(errorWrapper);

      return wrapMethod(() => originalMethod.apply(this, args), context as any);
    };

    return descriptor;
  };
}

// Decorator function for tool methods
export function withToolErrorHandling(errorWrapper: McpErrorWrapper, toolName: string) {
  return createErrorHandlingDecorator(errorWrapper, 'tool', toolName);
}

// Decorator function for prompt methods
export function withPromptErrorHandling(errorWrapper: McpErrorWrapper, promptName: string) {
  return createErrorHandlingDecorator(errorWrapper, 'prompt', promptName);
}
