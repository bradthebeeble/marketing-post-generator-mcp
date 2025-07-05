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
    fallbackAdapters: process.env.SEARCH_FALLBACK_ADAPTERS ? process.env.SEARCH_FALLBACK_ADAPTERS.split(',') : [],
    adapterConfigs: {
      'web-scraping': {
        sampleSize: parseInt(process.env.SEARCH_WEB_SAMPLE_SIZE || '5', 10),
        maxRequestsPerSecond: parseInt(process.env.SEARCH_WEB_RATE_LIMIT || '2', 10),
        timeout: parseInt(process.env.SEARCH_WEB_TIMEOUT || '30000', 10),
        userAgent: process.env.SEARCH_WEB_USER_AGENT || 'Mozilla/5.0 (compatible; MarketingPostGenerator/1.0)',
      },
      'firecrawl': {
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
}
