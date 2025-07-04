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
}
