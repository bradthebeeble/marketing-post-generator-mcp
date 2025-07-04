// Core MCP Server implementation for Marketing Post Generator

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DIContainer } from './container/DIContainer.js';
import { ServerConfig } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import winston from 'winston';

export class MarketingPostGeneratorServer {
  private mcpServer!: Server;
  private readonly container: DIContainer;
  private readonly logger: winston.Logger;

  constructor(private readonly config: ServerConfig) {
    this.logger = createLogger(config.logging);
    this.container = new DIContainer();
    this.initializeDependencies();
    this.initializeMCPServer();
  }

  private initializeDependencies(): void {
    // Register core services with the DI container
    this.container.register('Logger', () => this.logger);
    this.container.register('Config', () => this.config);

    this.logger.info('Dependencies initialized', {
      registeredServices: this.container.getRegisteredTokens(),
    });
  }

  private initializeMCPServer(): void {
    // Create transport based on configuration
    const transport = this.createTransport();

    // Initialize MCP server
    this.mcpServer = new Server(
      {
        name: 'marketing-post-generator-mcp',
        version: process.env.npm_package_version || '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    // Connect transport
    void this.mcpServer.connect(transport);

    this.logger.info('MCP Server initialized', {
      mode: this.config.server.mode,
      transport: this.config.server.transport,
    });
  }

  private createTransport(): StdioServerTransport {
    switch (this.config.server.mode) {
      case 'local':
        return new StdioServerTransport();
      case 'remote':
        // TODO: Implement HTTP transport when needed
        throw new Error('HTTP transport not yet implemented');
      default:
        throw new Error(`Unsupported server mode: ${this.config.server.mode}`);
    }
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Starting Marketing Post Generator MCP Server...');
      // Server starts automatically when connected to transport
      this.logger.info('Server is ready to accept connections');
    } catch (error) {
      this.logger.error('Failed to start server', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Marketing Post Generator MCP Server...');
      await this.mcpServer.close();
      this.logger.info('Server stopped successfully');
    } catch (error) {
      this.logger.error('Error during server shutdown', { error });
      throw error;
    }
  }
}
