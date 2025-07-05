import { Logger } from '../../utils/logger';

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  keyGenerator?: (identifier: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  resetOnSuccessfulRequest?: boolean;
}

export interface RateLimitInfo {
  totalRequests: number;
  remainingRequests: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
  firstRequest: number;
}

export class RateLimitService {
  private logger: Logger;
  private store: Map<string, RateLimitRecord>;
  private cleanupInterval: NodeJS.Timeout;

  constructor(logger: Logger) {
    this.logger = logger;
    this.store = new Map();
    
    // Clean up expired records every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  checkRateLimit(
    identifier: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const key = config.keyGenerator ? config.keyGenerator(identifier) : identifier;
    const now = Date.now();
    
    // Get or create record
    let record = this.store.get(key);
    
    if (!record || now >= record.resetTime) {
      // Create new record or reset expired one
      record = {
        count: 1,
        resetTime: now + config.windowMs,
        firstRequest: now,
      };
      this.store.set(key, record);
      
      const info: RateLimitInfo = {
        totalRequests: 1,
        remainingRequests: config.maxRequests - 1,
        resetTime: record.resetTime,
      };
      
      return {
        allowed: true,
        info,
      };
    }
    
    // Check if limit exceeded
    if (record.count >= config.maxRequests) {
      const info: RateLimitInfo = {
        totalRequests: record.count,
        remainingRequests: 0,
        resetTime: record.resetTime,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      };
      
      this.logger.warn('Rate limit exceeded', {
        identifier,
        count: record.count,
        maxRequests: config.maxRequests,
        resetTime: record.resetTime,
      });
      
      return {
        allowed: false,
        info,
      };
    }
    
    // Increment count
    record.count++;
    
    const info: RateLimitInfo = {
      totalRequests: record.count,
      remainingRequests: config.maxRequests - record.count,
      resetTime: record.resetTime,
    };
    
    return {
      allowed: true,
      info,
    };
  }

  recordRequest(
    identifier: string,
    config: RateLimitConfig,
    success: boolean = true
  ): void {
    // Skip recording based on configuration
    if (success && config.skipSuccessfulRequests) {
      return;
    }
    
    if (!success && config.skipFailedRequests) {
      return;
    }
    
    const key = config.keyGenerator ? config.keyGenerator(identifier) : identifier;
    const now = Date.now();
    
    // Reset on successful request if configured
    if (success && config.resetOnSuccessfulRequest) {
      this.store.delete(key);
      return;
    }
    
    // Update record
    const record = this.store.get(key);
    if (record && now < record.resetTime) {
      // Record is already updated in checkRateLimit
      // This method is mainly for post-request updates
      this.logger.debug('Rate limit request recorded', {
        identifier,
        count: record.count,
        success,
      });
    }
  }

  getRateLimitInfo(identifier: string, config: RateLimitConfig): RateLimitInfo | null {
    const key = config.keyGenerator ? config.keyGenerator(identifier) : identifier;
    const record = this.store.get(key);
    
    if (!record) {
      return null;
    }
    
    const now = Date.now();
    
    if (now >= record.resetTime) {
      // Record expired
      return null;
    }
    
    return {
      totalRequests: record.count,
      remainingRequests: Math.max(0, config.maxRequests - record.count),
      resetTime: record.resetTime,
      retryAfter: record.count >= config.maxRequests ? 
        Math.ceil((record.resetTime - now) / 1000) : undefined,
    };
  }

  resetRateLimit(identifier: string, config: RateLimitConfig): void {
    const key = config.keyGenerator ? config.keyGenerator(identifier) : identifier;
    this.store.delete(key);
    
    this.logger.info('Rate limit reset', {
      identifier,
      key,
    });
  }

  getStats(): {
    totalKeys: number;
    activeRecords: number;
    memoryUsage: number;
  } {
    const now = Date.now();
    let activeRecords = 0;
    
    for (const [, record] of this.store) {
      if (now < record.resetTime) {
        activeRecords++;
      }
    }
    
    return {
      totalKeys: this.store.size,
      activeRecords,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, record] of this.store) {
      if (now >= record.resetTime) {
        this.store.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.debug('Rate limit cleanup completed', {
        cleanedRecords: cleanedCount,
        remainingRecords: this.store.size,
      });
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // Very strict - for sensitive operations
  strict: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 5,
  },
  
  // Standard - for general API usage
  standard: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60,
  },
  
  // Generous - for bulk operations
  generous: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 300,
  },
  
  // Hourly limit
  hourly: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 1000,
  },
  
  // Daily limit
  daily: {
    windowMs: 24 * 60 * 60 * 1000,  // 24 hours
    maxRequests: 10000,
  },
} as const;