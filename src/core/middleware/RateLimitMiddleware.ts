import { Request, Response, NextFunction } from 'express';
import {
  RateLimitService,
  RateLimitConfig,
  rateLimitConfigs,
} from '../../services/rateLimit/RateLimitService';
import { RateLimitError } from '../errors/BaseError';
import { getRequestId } from './RequestIdMiddleware';

export interface RateLimitMiddlewareConfig extends RateLimitConfig {
  identifierExtractor?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response, info: any) => void;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  message?: string;
}

export class RateLimitMiddleware {
  private readonly rateLimitService: RateLimitService;
  private readonly config: RateLimitMiddlewareConfig;

  constructor(rateLimitService: RateLimitService, config: RateLimitMiddlewareConfig) {
    this.rateLimitService = rateLimitService;
    this.config = {
      identifierExtractor: (req) => this.getClientIdentifier(req),
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests, please try again later.',
      ...config,
    };
  }

  createMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const identifier = this.config.identifierExtractor!(req);
        const result = this.rateLimitService.checkRateLimit(identifier, this.config);

        // Set rate limit headers
        this.setRateLimitHeaders(res, result.info);

        if (!result.allowed) {
          // Record the failed request
          this.rateLimitService.recordRequest(identifier, this.config, false);

          // Call custom handler if provided
          if (this.config.onLimitReached) {
            this.config.onLimitReached(req, res, result.info);
          }

          // Create rate limit error
          const rateLimitError = new RateLimitError(
            this.config.message || 'Too many requests, please try again later.',
            {
              identifier,
              requestId: getRequestId(req),
              rateLimitInfo: result.info,
            }
          );

          // Set retry-after header
          if (result.info.retryAfter) {
            res.set('Retry-After', result.info.retryAfter.toString());
          }

          return res.status(429).json({
            error: rateLimitError.toJSON(),
            retryAfter: result.info.retryAfter,
          });
        }

        // Record successful request check
        this.rateLimitService.recordRequest(identifier, this.config, true);

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  private getClientIdentifier(req: Request): string {
    // Try to get IP address from various headers
    const ip =
      req.get('X-Forwarded-For')?.split(',')[0] ||
      req.get('X-Real-IP') ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown';

    // You might want to include user ID if available
    const userId = (req as any).user?.id;

    return userId ? `user:${userId}` : `ip:${ip}`;
  }

  private setRateLimitHeaders(res: Response, info: any): void {
    if (this.config.standardHeaders) {
      // Standard rate limit headers (draft RFC)
      res.set('RateLimit-Limit', this.config.maxRequests.toString());
      res.set('RateLimit-Remaining', info.remainingRequests.toString());
      res.set('RateLimit-Reset', new Date(info.resetTime).toISOString());
    }

    if (this.config.legacyHeaders) {
      // Legacy headers (commonly used)
      res.set('X-RateLimit-Limit', this.config.maxRequests.toString());
      res.set('X-RateLimit-Remaining', info.remainingRequests.toString());
      res.set('X-RateLimit-Reset', Math.ceil(info.resetTime / 1000).toString());
    }
  }
}

// Helper functions to create common rate limit middleware
export function createRateLimitMiddleware(
  rateLimitService: RateLimitService,
  config?: RateLimitMiddlewareConfig
) {
  const middleware = new RateLimitMiddleware(rateLimitService, config || rateLimitConfigs.standard);
  return middleware.createMiddleware();
}

export function createStrictRateLimitMiddleware(rateLimitService: RateLimitService) {
  return createRateLimitMiddleware(rateLimitService, {
    ...rateLimitConfigs.strict,
    message: 'Rate limit exceeded for sensitive operation.',
  });
}

export function createGenerousRateLimitMiddleware(rateLimitService: RateLimitService) {
  return createRateLimitMiddleware(rateLimitService, {
    ...rateLimitConfigs.generous,
    message: 'Rate limit exceeded for bulk operation.',
  });
}

// Path-specific rate limiting
export function createPathSpecificRateLimit(
  rateLimitService: RateLimitService,
  pathConfigs: Record<string, RateLimitMiddlewareConfig>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;

    // Find matching path configuration
    const matchingConfig = Object.entries(pathConfigs).find(([pattern, config]) => {
      if (pattern.includes('*')) {
        // Simple wildcard matching
        const regexPattern = pattern.replace(/\*/g, '.*');
        return new RegExp(`^${regexPattern}$`).test(path);
      }
      return path.startsWith(pattern);
    });

    if (matchingConfig) {
      const [, config] = matchingConfig;
      const middleware = new RateLimitMiddleware(rateLimitService, config);
      return middleware.createMiddleware()(req, res, next);
    }

    // No specific config found, use default
    const defaultMiddleware = createRateLimitMiddleware(rateLimitService);
    return defaultMiddleware(req, res, next);
  };
}

// User-specific rate limiting
export function createUserRateLimit(
  rateLimitService: RateLimitService,
  config: RateLimitMiddlewareConfig = rateLimitConfigs.standard
) {
  return createRateLimitMiddleware(rateLimitService, {
    ...config,
    identifierExtractor: (req) => {
      const userId = (req as any).user?.id;
      return userId ? `user:${userId}` : `ip:${req.ip}`;
    },
  });
}

// API key-specific rate limiting
export function createApiKeyRateLimit(
  rateLimitService: RateLimitService,
  config: RateLimitMiddlewareConfig = rateLimitConfigs.standard
) {
  return createRateLimitMiddleware(rateLimitService, {
    ...config,
    identifierExtractor: (req) => {
      const apiKey = req.get('X-API-Key') || req.get('Authorization');
      return apiKey ? `api:${apiKey}` : `ip:${req.ip}`;
    },
  });
}
