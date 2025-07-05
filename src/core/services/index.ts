// Service registration for dependency injection
import { DIContainer } from '../container/DIContainer';
import { ErrorHandlingService } from './ErrorHandlingService';
import { RateLimitService } from '../../services/rateLimit/RateLimitService';
import { createMcpErrorWrapper } from '../errors/McpErrorWrapper';
import { createLogger } from '../../utils/logger';
import { ServerConfig } from '../../types';

// Service tokens
export const SERVICE_TOKENS = {
  ERROR_HANDLING_SERVICE: 'ErrorHandlingService',
  RATE_LIMIT_SERVICE: 'RateLimitService',
  MCP_ERROR_WRAPPER: 'McpErrorWrapper',
  LOGGER: 'Logger',
} as const;

export function registerErrorHandlingServices(container: DIContainer, config: ServerConfig): void {
  // Register logger
  container.register(
    SERVICE_TOKENS.LOGGER,
    () => createLogger('MCP-Server'),
    true
  );

  // Register error handling service
  container.register(
    SERVICE_TOKENS.ERROR_HANDLING_SERVICE,
    () => new ErrorHandlingService(config.errorHandling),
    true
  );

  // Register rate limit service
  container.register(
    SERVICE_TOKENS.RATE_LIMIT_SERVICE,
    () => {
      const logger = container.resolve<ReturnType<typeof createLogger>>(SERVICE_TOKENS.LOGGER);
      return new RateLimitService(logger);
    },
    true
  );

  // Register MCP error wrapper
  container.register(
    SERVICE_TOKENS.MCP_ERROR_WRAPPER,
    () => {
      const errorHandlingService = container.resolve<ErrorHandlingService>(SERVICE_TOKENS.ERROR_HANDLING_SERVICE);
      const logger = container.resolve<ReturnType<typeof createLogger>>(SERVICE_TOKENS.LOGGER);
      return createMcpErrorWrapper(errorHandlingService.getErrorHandler(), logger);
    },
    true
  );
}

// Helper function to resolve services
export function getErrorHandlingService(container: DIContainer): ErrorHandlingService {
  return container.resolve<ErrorHandlingService>(SERVICE_TOKENS.ERROR_HANDLING_SERVICE);
}

export function getRateLimitService(container: DIContainer): RateLimitService {
  return container.resolve<RateLimitService>(SERVICE_TOKENS.RATE_LIMIT_SERVICE);
}

export function getMcpErrorWrapper(container: DIContainer) {
  return container.resolve(SERVICE_TOKENS.MCP_ERROR_WRAPPER);
}

export function getLogger(container: DIContainer) {
  return container.resolve(SERVICE_TOKENS.LOGGER);
}