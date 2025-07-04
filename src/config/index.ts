// Configuration management for the Marketing Post Generator MCP

import { ServerConfig } from '../types/index.js';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const DEFAULT_CONFIG: ServerConfig = {
  server: {
    mode: (process.env.MCP_MODE as 'local' | 'remote') || 'local',
    transport: (process.env.MCP_TRANSPORT as 'stdio' | 'http') || 'stdio',
    port: parseInt(process.env.MCP_PORT || '3000', 10),
    host: process.env.MCP_HOST || '0.0.0.0',
  },
  postgen: {
    dataDir: process.env.POSTGEN_DATA_DIR || '.postgen',
    cacheEnabled: parseBoolean(process.env.POSTGEN_CACHE_ENABLED, true),
    cacheTtl: parseInt(process.env.POSTGEN_CACHE_TTL || '3600000', 10), // 1 hour
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'simple',
  },
};

export const REMOTE_CONFIG: Partial<ServerConfig> = {
  server: {
    mode: 'remote',
    transport: 'http',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
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
