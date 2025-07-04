#!/usr/bin/env node

// Marketing Post Generator MCP Server Entry Point

import 'dotenv/config';
import { MarketingPostGeneratorServer } from './core/MarketingPostGeneratorServer.js';
import { getConfig, validateConfig } from './config/index.js';
import { createLogger } from './utils/logger.js';

async function main(): Promise<void> {
  try {
    // Load and validate configuration
    const config = getConfig();
    validateConfig(config);

    // Initialize logger
    const logger = createLogger(config.logging);
    logger.info('Starting Marketing Post Generator MCP Server', {
      mode: config.server.mode,
      transport: config.server.transport,
    });

    // Create and start the server
    const server = new MarketingPostGeneratorServer(config);
    await server.start();

    logger.info('Marketing Post Generator MCP Server started successfully');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start Marketing Post Generator MCP Server:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
