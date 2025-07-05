import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger';

export interface LoggingConfig {
  skipPaths?: string[];
  logRequestBody?: boolean;
  logResponseBody?: boolean;
  logHeaders?: boolean;
  maxBodyLength?: number;
  sensitiveHeaders?: string[];
  sensitiveBodyFields?: string[];
}

export interface RequestLogData {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  headers?: Record<string, string>;
  body?: any;
  timestamp: string;
  contentLength?: number;
}

export interface ResponseLogData {
  requestId: string;
  statusCode: number;
  contentLength?: number;
  responseTime: number;
  headers?: Record<string, string>;
  body?: any;
  timestamp: string;
}

export class LoggingMiddleware {
  private readonly logger: Logger;
  private readonly config: LoggingConfig;

  constructor(logger: Logger, config: LoggingConfig = {}) {
    this.logger = logger;
    this.config = {
      skipPaths: ['/health', '/metrics', '/favicon.ico'],
      logRequestBody: true,
      logResponseBody: false,
      logHeaders: true,
      maxBodyLength: 10000,
      sensitiveHeaders: ['authorization', 'cookie', 'x-api-key', 'x-auth-token'],
      sensitiveBodyFields: ['password', 'token', 'secret', 'apiKey'],
      ...config,
    };
  }

  createMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = req.get('X-Request-ID') || this.generateRequestId();

      // Add request ID to request object for downstream usage
      (req as any).requestId = requestId;

      // Skip logging for specified paths
      if (this.shouldSkipLogging(req.path)) {
        return next();
      }

      // Log request
      this.logRequest(req, requestId);

      // Capture response
      const originalSend = res.send;
      const originalJson = res.json;
      let responseBody: any;
      let responseCaptured = false;

      res.send = function (body): Response {
        if (!responseCaptured) {
          responseBody = body;
          responseCaptured = true;
        }
        return originalSend.call(this, body) as Response;
      };

      res.json = function (body): Response {
        if (!responseCaptured) {
          responseBody = body;
          responseCaptured = true;
        }
        return originalJson.call(this, body) as Response;
      };

      // Log response when request finishes
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.logResponse(res, responseTime, requestId, responseBody);
      });

      next();
    };
  }

  private shouldSkipLogging(path: string): boolean {
    return this.config.skipPaths?.some((skipPath) => path.startsWith(skipPath)) || false;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logRequest(req: Request, requestId: string): void {
    const requestData: RequestLogData = {
      requestId,
      method: req.method,
      url: req.url,
      ip: this.getClientIP(req),
      timestamp: new Date().toISOString(),
    };

    const userAgent = req.get('User-Agent');
    if (userAgent) {
      requestData.userAgent = userAgent;
    }

    const contentLength = req.get('Content-Length');
    if (contentLength) {
      requestData.contentLength = parseInt(contentLength);
    }

    // Add headers if configured
    if (this.config.logHeaders) {
      requestData.headers = this.sanitizeHeaders(req.headers);
    }

    // Add body if configured
    if (this.config.logRequestBody && req.body) {
      requestData.body = this.sanitizeBody(req.body);
    }

    this.logger.info('HTTP Request', requestData);
  }

  private logResponse(
    res: Response,
    responseTime: number,
    requestId: string,
    responseBody: any
  ): void {
    const responseData: ResponseLogData = {
      requestId,
      statusCode: res.statusCode,
      responseTime,
      timestamp: new Date().toISOString(),
    };

    const contentLength = res.get('Content-Length');
    if (contentLength) {
      responseData.contentLength = parseInt(contentLength);
    }

    // Add headers if configured
    if (this.config.logHeaders) {
      responseData.headers = this.sanitizeHeaders(res.getHeaders());
    }

    // Add body if configured
    if (this.config.logResponseBody && responseBody) {
      responseData.body = this.sanitizeBody(responseBody);
    }

    // Choose log level based on status code
    const logLevel = this.getLogLevel(res.statusCode);
    this.logger[logLevel]('HTTP Response', responseData);
  }

  private getClientIP(req: Request): string {
    return (
      req.get('X-Forwarded-For')?.split(',')[0] ||
      req.get('X-Real-IP') ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (this.config.sensitiveHeaders?.includes(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }

    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    // Handle string bodies
    if (typeof body === 'string') {
      if (body.length > (this.config.maxBodyLength || 10000)) {
        // Ensure we don't break multi-byte characters
        const maxLength = this.config.maxBodyLength || 10000;
        const truncated = body.slice(0, maxLength);
        // Remove any incomplete multi-byte sequence at the end
        const cleanTruncated = truncated.replace(/[\uD800-\uDBFF]$/, '');
        return cleanTruncated + '... [TRUNCATED]';
      }
      return body;
    }

    // Handle object bodies
    if (typeof body === 'object') {
      const sanitized = { ...body };

      // Remove sensitive fields
      this.config.sensitiveBodyFields?.forEach((field) => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });

      // Truncate large objects
      const stringified = JSON.stringify(sanitized);
      if (stringified.length > (this.config.maxBodyLength || 10000)) {
        return stringified.substring(0, this.config.maxBodyLength) + '... [TRUNCATED]';
      }

      return sanitized;
    }

    return body;
  }

  private getLogLevel(statusCode: number): 'error' | 'warn' | 'info' | 'debug' {
    if (statusCode >= 500) {
      return 'error';
    } else if (statusCode >= 400) {
      return 'warn';
    } else {
      return 'info';
    }
  }
}

// Helper function to create logging middleware
export function createLoggingMiddleware(logger: Logger, config?: LoggingConfig) {
  const middleware = new LoggingMiddleware(logger, config);
  return middleware.createMiddleware();
}
