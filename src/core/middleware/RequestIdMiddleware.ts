import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestIdConfig {
  headerName?: string;
  generateId?: () => string;
  setResponseHeader?: boolean;
  responseHeaderName?: string;
}

export class RequestIdMiddleware {
  private readonly config: RequestIdConfig;

  constructor(config: RequestIdConfig = {}) {
    this.config = {
      headerName: 'X-Request-ID',
      generateId: () => uuidv4(),
      setResponseHeader: true,
      responseHeaderName: 'X-Request-ID',
      ...config,
    };
  }

  createMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Get request ID from header or generate new one
      let requestId = req.get(this.config.headerName!);

      if (!requestId) {
        requestId = this.config.generateId!();
      }

      // Add request ID to request object
      (req as any).requestId = requestId;

      // Set response header if configured
      if (this.config.setResponseHeader) {
        res.set(this.config.responseHeaderName!, requestId);
      }

      // Add request ID to response locals for use in other middleware
      res.locals.requestId = requestId;

      next();
    };
  }
}

// Helper function to create request ID middleware
export function createRequestIdMiddleware(config?: RequestIdConfig) {
  const middleware = new RequestIdMiddleware(config);
  return middleware.createMiddleware();
}

// Helper function to get request ID from request object
export function getRequestId(req: Request): string | undefined {
  return (req as any).requestId;
}

// Helper function to get request ID from response locals
export function getRequestIdFromResponse(res: Response): string | undefined {
  return res.locals.requestId;
}
