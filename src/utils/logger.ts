// Logger utility for the Marketing Post Generator MCP

import winston from 'winston';

export interface LoggingConfig {
  level: string;
  format: string;
}

export type Logger = winston.Logger;

export function createLogger(config: LoggingConfig): winston.Logger {
  const logger = winston.createLogger({
    level: config.level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: {
      service: 'marketing-post-generator-mcp',
      version: process.env.npm_package_version || '1.0.0',
    },
    transports: [
      // Console transport with colorized output for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          })
        ),
      }),

      // Error file transport
      new winston.transports.File({
        filename: 'error.log',
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
    ],
  });

  return logger;
}
