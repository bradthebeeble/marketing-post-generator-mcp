// Configuration management for the Marketing Post Generator MCP

import { ServerConfig } from '../types/index.js';
import { randomUUID } from 'crypto';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function createHttpConfig() {
  const config: any = {
    enableJsonResponse: parseBoolean(process.env.MCP_HTTP_JSON_RESPONSE, false),
    enableDnsRebindingProtection: parseBoolean(process.env.MCP_HTTP_DNS_PROTECTION, false),
    sessionIdGenerator: () => randomUUID(),
  };

  if (process.env.MCP_HTTP_ALLOWED_HOSTS) {
    config.allowedHosts = process.env.MCP_HTTP_ALLOWED_HOSTS.split(',');
  }

  if (process.env.MCP_HTTP_ALLOWED_ORIGINS) {
    config.allowedOrigins = process.env.MCP_HTTP_ALLOWED_ORIGINS.split(',');
  }

  return config;
}

export const DEFAULT_CONFIG: ServerConfig = {
  server: {
    mode: (process.env.MCP_MODE as 'local' | 'remote') || 'local',
    transport: (process.env.MCP_TRANSPORT as 'stdio' | 'http') || 'stdio',
    port: parseInt(process.env.MCP_PORT || '3000', 10),
    host: process.env.MCP_HOST || '0.0.0.0',
    http: createHttpConfig(),
  },
  postgen: {
    dataDir: process.env.POSTGEN_DATA_DIR || '.postgen',
    cacheEnabled: parseBoolean(process.env.POSTGEN_CACHE_ENABLED, true),
    cacheTtl: parseInt(process.env.POSTGEN_CACHE_TTL || '3600000', 10), // 1 hour
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
    ...(process.env.CLAUDE_BASE_URL && { baseUrl: process.env.CLAUDE_BASE_URL }),
    maxRetries: parseInt(process.env.CLAUDE_MAX_RETRIES || '3', 10),
    timeout: parseInt(process.env.CLAUDE_TIMEOUT || '30000', 10), // 30 seconds
    rateLimit: {
      requestsPerMinute: parseInt(process.env.CLAUDE_RATE_LIMIT_REQUESTS || '60', 10),
      tokensPerMinute: parseInt(process.env.CLAUDE_RATE_LIMIT_TOKENS || '50000', 10),
    },
  },
  search: {
    defaultAdapter: process.env.SEARCH_DEFAULT_ADAPTER || 'web-scraping',
    fallbackAdapters: process.env.SEARCH_FALLBACK_ADAPTERS
      ? process.env.SEARCH_FALLBACK_ADAPTERS.split(',')
      : [],
    adapterConfigs: {
      'web-scraping': {
        sampleSize: parseInt(process.env.SEARCH_WEB_SAMPLE_SIZE || '5', 10),
        maxRequestsPerSecond: parseInt(process.env.SEARCH_WEB_RATE_LIMIT || '2', 10),
        timeout: parseInt(process.env.SEARCH_WEB_TIMEOUT || '30000', 10),
        userAgent:
          process.env.SEARCH_WEB_USER_AGENT ||
          'Mozilla/5.0 (compatible; MarketingPostGenerator/1.0)',
      },
      firecrawl: {
        apiKey: process.env.FIRECRAWL_API_KEY || '',
        baseUrl: process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev',
        rateLimit: parseInt(process.env.FIRECRAWL_RATE_LIMIT || '30', 10),
        maxRetries: parseInt(process.env.FIRECRAWL_MAX_RETRIES || '3', 10),
        timeoutMs: parseInt(process.env.FIRECRAWL_TIMEOUT || '30000', 10),
        maxCreditsPerDay: parseInt(process.env.FIRECRAWL_MAX_CREDITS_PER_DAY || '1000', 10),
      },
    },
  },
  logging: {
    level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | 'trace') || 'info',
    format: (process.env.LOG_FORMAT as 'simple' | 'json' | 'pretty') || 'simple',
  },
  errorHandling: {
    enableErrorReporting: parseBoolean(process.env.ERROR_REPORTING_ENABLED, true),
    enableStackTrace: parseBoolean(process.env.ERROR_STACK_TRACE_ENABLED, true),
    maxRecentErrors: parseInt(process.env.ERROR_MAX_RECENT || '100', 10),
    excludeStackTraceForCodes: process.env.ERROR_EXCLUDE_STACK_CODES
      ? process.env.ERROR_EXCLUDE_STACK_CODES.split(',')
      : ['VALIDATION_ERROR', 'RATE_LIMIT_ERROR'],
    notificationEnabled: parseBoolean(process.env.ERROR_NOTIFICATION_ENABLED, false),
  },
  rateLimit: {
    enableRateLimit: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
    defaultWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    defaultMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
    enableStandardHeaders: parseBoolean(process.env.RATE_LIMIT_STANDARD_HEADERS, true),
    enableLegacyHeaders: parseBoolean(process.env.RATE_LIMIT_LEGACY_HEADERS, false),
  },
};

function createRemoteHttpConfig() {
  const config: any = {
    enableJsonResponse: parseBoolean(process.env.MCP_HTTP_JSON_RESPONSE, false),
    enableDnsRebindingProtection: parseBoolean(process.env.MCP_HTTP_DNS_PROTECTION, true),
    sessionIdGenerator: () => randomUUID(),
  };

  if (process.env.MCP_HTTP_ALLOWED_HOSTS) {
    config.allowedHosts = process.env.MCP_HTTP_ALLOWED_HOSTS.split(',');
  } else {
    config.allowedHosts = ['localhost'];
  }

  if (process.env.MCP_HTTP_ALLOWED_ORIGINS) {
    config.allowedOrigins = process.env.MCP_HTTP_ALLOWED_ORIGINS.split(',');
  } else {
    config.allowedOrigins = ['*'];
  }

  return config;
}

export const REMOTE_CONFIG: Partial<ServerConfig> = {
  server: {
    mode: 'remote',
    transport: 'http',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    http: createRemoteHttpConfig(),
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'],
    allowedHeaders: ['mcp-session-id', 'content-type', 'authorization'],
    credentials: true,
  },
};

export function getConfig(): ServerConfig {
  const baseConfig = { ...DEFAULT_CONFIG };

  if (baseConfig.server.mode === 'remote') {
    return {
      ...baseConfig,
      ...REMOTE_CONFIG,
      server: {
        ...baseConfig.server,
        ...REMOTE_CONFIG.server,
        http: {
          ...baseConfig.server.http,
          ...REMOTE_CONFIG.server?.http,
        },
      },
    };
  }

  return baseConfig;
}

export function validateConfig(config: ServerConfig): void {
  if (!config.server.mode || !['local', 'remote'].includes(config.server.mode)) {
    throw new Error('Invalid server mode. Must be "local" or "remote"');
  }

  if (!config.server.transport || !['stdio', 'http'].includes(config.server.transport)) {
    throw new Error('Invalid transport. Must be "stdio" or "http"');
  }

  if (
    config.server.mode === 'remote' &&
    (!config.server.port || config.server.port < 1 || config.server.port > 65535)
  ) {
    throw new Error('Invalid port for remote mode. Must be between 1 and 65535');
  }

  if (!config.postgen.dataDir) {
    throw new Error('PostGen data directory is required');
  }

  if (!config.claude.apiKey) {
    throw new Error('Claude API key is required. Set CLAUDE_API_KEY environment variable');
  }

  if (
    config.claude.maxRetries !== undefined &&
    (config.claude.maxRetries < 0 || config.claude.maxRetries > 10)
  ) {
    throw new Error('Claude max retries must be between 0 and 10');
  }

  if (
    config.claude.timeout !== undefined &&
    (config.claude.timeout < 1000 || config.claude.timeout > 120000)
  ) {
    throw new Error('Claude timeout must be between 1000ms and 120000ms (2 minutes)');
  }

  if (config.claude.rateLimit) {
    if (
      config.claude.rateLimit.requestsPerMinute < 1 ||
      config.claude.rateLimit.requestsPerMinute > 1000
    ) {
      throw new Error('Claude rate limit requests per minute must be between 1 and 1000');
    }
    if (
      config.claude.rateLimit.tokensPerMinute < 1000 ||
      config.claude.rateLimit.tokensPerMinute > 1000000
    ) {
      throw new Error('Claude rate limit tokens per minute must be between 1000 and 1000000');
    }
  }

  // Validate errorHandling configuration
  if (config.errorHandling) {
    if (typeof config.errorHandling.enableErrorReporting !== 'boolean') {
      throw new Error('Error handling enableErrorReporting must be a boolean');
    }
    if (typeof config.errorHandling.enableStackTrace !== 'boolean') {
      throw new Error('Error handling enableStackTrace must be a boolean');
    }
    if (typeof config.errorHandling.notificationEnabled !== 'boolean') {
      throw new Error('Error handling notificationEnabled must be a boolean');
    }
    if (
      config.errorHandling.maxRecentErrors !== undefined &&
      (config.errorHandling.maxRecentErrors < 10 || config.errorHandling.maxRecentErrors > 1000)
    ) {
      throw new Error('Error handling maxRecentErrors must be between 10 and 1000');
    }
    if (
      config.errorHandling.excludeStackTraceForCodes !== undefined &&
      !Array.isArray(config.errorHandling.excludeStackTraceForCodes)
    ) {
      throw new Error('Error handling excludeStackTraceForCodes must be an array');
    }
    if (config.errorHandling.excludeStackTraceForCodes?.some((code) => typeof code !== 'string')) {
      throw new Error('Error handling excludeStackTraceForCodes must be an array of strings');
    }
  }

  // Validate rateLimit configuration
  if (config.rateLimit) {
    if (typeof config.rateLimit.enableRateLimit !== 'boolean') {
      throw new Error('Rate limit enableRateLimit must be a boolean');
    }
    if (typeof config.rateLimit.enableStandardHeaders !== 'boolean') {
      throw new Error('Rate limit enableStandardHeaders must be a boolean');
    }
    if (typeof config.rateLimit.enableLegacyHeaders !== 'boolean') {
      throw new Error('Rate limit enableLegacyHeaders must be a boolean');
    }
    if (
      config.rateLimit.defaultWindowMs !== undefined &&
      (config.rateLimit.defaultWindowMs < 1000 || config.rateLimit.defaultWindowMs > 3600000)
    ) {
      throw new Error(
        'Rate limit defaultWindowMs must be between 1000ms (1 second) and 3600000ms (1 hour)'
      );
    }
    if (
      config.rateLimit.defaultMaxRequests !== undefined &&
      (config.rateLimit.defaultMaxRequests < 1 || config.rateLimit.defaultMaxRequests > 10000)
    ) {
      throw new Error('Rate limit defaultMaxRequests must be between 1 and 10000');
    }
  }
}
