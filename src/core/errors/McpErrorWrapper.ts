import { ToolExecutionError, ContentGenerationError, ServiceUnavailableError } from './BaseError';
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

export class McpErrorWrapper {
  private errorHandler: ErrorHandler;
  private logger: Logger;

  constructor(errorHandler: ErrorHandler, logger: Logger) {
    this.errorHandler = errorHandler;
    this.logger = logger;
  }

  async wrapToolExecution<T>(
    toolFunction: () => Promise<T>,
    context: McpToolContext
  ): Promise<T> {
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
      
      // Create tool execution error
      const toolError = new ToolExecutionError(
        `Tool '${context.toolName}' execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context.toolName,
        error instanceof Error ? error : undefined
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
          severity: this.determineSeverity(error, context),
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
      
      // Create content generation error for prompts
      const promptError = new ContentGenerationError(
        `Prompt '${context.promptName}' execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          ...context,
          executionTime,
        },
        error instanceof Error ? error : undefined
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
          severity: this.determineSeverity(error, context),
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

    let lastError: Error;
    
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

        throw this.errorHandler.handleError(
          finalError,
          context,
          {
            severity: 'high',
            shouldNotify: attempt > maxRetries,
          }
        );
      }
    }

    throw lastError;
  }

  private determineSeverity(
    error: unknown,
    context: McpToolContext | McpPromptContext
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof Error) {
      // Network or timeout errors are medium severity
      if (error.message.includes('timeout') || error.message.includes('network')) {
        return 'medium';
      }
      
      // Authentication/authorization errors are high severity
      if (error.message.includes('auth') || error.message.includes('permission')) {
        return 'high';
      }
      
      // Validation errors are low severity
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return 'low';
      }
    }

    // Critical tools should have higher severity
    const criticalTools = ['generate_content', 'save_post', 'publish_post'];
    if ('toolName' in context && criticalTools.includes(context.toolName)) {
      return 'high';
    }

    return 'medium';
  }

  private shouldNotifyForTool(toolName: string): boolean {
    // Notify for critical tools
    const criticalTools = ['generate_content', 'save_post', 'publish_post'];
    return criticalTools.includes(toolName);
  }

  private shouldNotifyForPrompt(promptName: string): boolean {
    // Notify for critical prompts
    const criticalPrompts = ['content_generation', 'post_creation'];
    return criticalPrompts.includes(promptName);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Helper functions for easy usage
export function createMcpErrorWrapper(errorHandler: ErrorHandler, logger: Logger): McpErrorWrapper {
  return new McpErrorWrapper(errorHandler, logger);
}

// Decorator function for tool methods
export function withToolErrorHandling(
  errorWrapper: McpErrorWrapper,
  toolName: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context: McpToolContext = {
        toolName,
        arguments: args.length > 0 ? args[0] : {},
        requestId: (this as any).requestId,
        userId: (this as any).userId,
      };

      return errorWrapper.wrapToolExecution(
        () => originalMethod.apply(this, args),
        context
      );
    };

    return descriptor;
  };
}

// Decorator function for prompt methods
export function withPromptErrorHandling(
  errorWrapper: McpErrorWrapper,
  promptName: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const context: McpPromptContext = {
        promptName,
        arguments: args.length > 0 ? args[0] : {},
        requestId: (this as any).requestId,
        userId: (this as any).userId,
      };

      return errorWrapper.wrapPromptExecution(
        () => originalMethod.apply(this, args),
        context
      );
    };

    return descriptor;
  };
}