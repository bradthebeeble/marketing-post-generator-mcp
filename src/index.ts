#!/usr/bin/env node

// Marketing Post Generator MCP Server Entry Point

import 'dotenv/config';
import { MarketingPostGeneratorServer } from './core/MarketingPostGeneratorServer.js';
import { getConfig, validateConfig } from './config/index.js';

async function main(): Promise<void> {
  try {
    // Load and validate configuration
    const config = getConfig();
    validateConfig(config);

    console.log('Starting Marketing Post Generator MCP Server...');

    // Create and start the server
    const server = new MarketingPostGeneratorServer(config);
    await server.start();

    console.log('Marketing Post Generator MCP Server started successfully');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM, shutting down gracefully...');
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
