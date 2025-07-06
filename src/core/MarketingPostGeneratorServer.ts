// Core MCP Server implementation for Marketing Post Generator

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { DIContainer } from './container/DIContainer.js';
import { ServerConfig } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import { ClaudeService, IClaudeService } from '../services/claude/index.js';
import {
  SearchService,
  createSearchService,
  registerBuiltInAdapters,
} from '../services/search/index.js';
import { InitPrompt } from '../prompts/index.js';
import {
  SampleTool,
  SummarizeTool,
  GenerateToneTool,
  ContentPlanTool,
  NarrativeGeneratorTool,
  BlogPostGeneratorTool,
} from '../tools/index.js';
import { PromptFactory } from '../types/index.js';
import {
  ToolAndPromptRegistry,
  RegistryFactory,
  type RegistryFactoryConfig,
} from './registry/index.js';
import winston from 'winston';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'crypto';

export class MarketingPostGeneratorServer {
  private mcpServer!: Server;
  private readonly container: DIContainer;
  private readonly logger: winston.Logger;
  private httpServer?: express.Application;
  private httpTransport?: StreamableHTTPServerTransport;
  private registry?: ToolAndPromptRegistry;
  private registryFactory?: RegistryFactory;
  private readonly prompts: Map<string, PromptFactory> = new Map();
  private readonly tools: Map<
    string,
    {
      getToolDefinition(): Tool;
      execute(args: any, claudeService: IClaudeService): Promise<string>;
    }
  > = new Map();

  constructor(private readonly config: ServerConfig) {
    this.logger = createLogger(config.logging);
    this.container = new DIContainer();
  }

  async initialize(): Promise<void> {
    await this.initializeDependencies();
    await this.initializeMCPServer();
  }

  private async initializeDependencies(): Promise<void> {
    // Register core services with the DI container
    this.container.register('Logger', () => this.logger);
    this.container.register('Config', () => this.config);

    // Register Claude service
    this.container.register<IClaudeService>('ClaudeService', () => {
      return new ClaudeService(this.config.claude);
    });

    // Register built-in search adapters
    await registerBuiltInAdapters();

    // Register SearchService
    this.container.register<SearchService>('SearchService', () => {
      // Create SearchService from configuration - this will be initialized asynchronously
      throw new Error('SearchService must be initialized asynchronously');
    });

    // Initialize SearchService asynchronously
    const searchService = await createSearchService(this.config.search, this.logger);
    this.container.register<SearchService>('SearchService', () => searchService);

    // Initialize Registry Factory and Registry
    await this.initializeRegistry();

    this.logger.info('Dependencies initialized', {
      registeredServices: this.container.getRegisteredTokens(),
    });
  }

  private async initializeRegistry(): Promise<void> {
    try {
      // Create registry factory configuration
      const registryConfig: RegistryFactoryConfig = {
        registryConfig: {
          validateOnRegister: true,
          allowDuplicateNames: false,
          enforceVersioning: true,
          maxRetries: 3,
          enableLogging: true,
          namePrefix: 'marketing_post_generator_mcp__',
        },
        loggerConfig: {
          level: this.config.logging?.level || 'info',
        },
        enableValidation: true,
        enableVersioning: true,
        enableDiscovery: true,
      };

      // Initialize registry factory
      this.registryFactory = await RegistryFactory.createWithConfig(this.container, registryConfig);
      this.registry = this.registryFactory.getRegistry();

      this.logger.info('Registry system initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize registry system', { error });
      throw error;
    }
  }

  public getClaudeService(): IClaudeService {
    return this.container.resolve<IClaudeService>('ClaudeService');
  }

  public getRegistry(): ToolAndPromptRegistry | undefined {
    return this.registry;
  }

  private async initializeMCPServer(): Promise<void> {
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

    // Register prompts and tools
    await this.registerPrompts();
    await this.registerTools();

    // Connect transport
    void this.mcpServer.connect(transport);

    this.logger.info('MCP Server initialized', {
      mode: this.config.server.mode,
      transport: this.config.server.transport,
      registryEnabled: !!this.registry,
    });
  }

  private createTransport(): StdioServerTransport | StreamableHTTPServerTransport {
    switch (this.config.server.mode) {
      case 'local':
        this.logger.info('Creating stdio transport for local mode');
        return new StdioServerTransport();
      case 'remote':
        this.logger.info('Creating HTTP transport for remote mode');
        return this.createHttpTransport();
      default:
        throw new Error(`Unsupported server mode: ${this.config.server.mode}`);
    }
  }

  private createHttpTransport(): StreamableHTTPServerTransport {
    const httpConfig = this.config.server.http || {};

    // Create the HTTP transport with configuration
    const transportOptions: any = {
      sessionIdGenerator: httpConfig.sessionIdGenerator || (() => randomUUID()),
      enableJsonResponse: httpConfig.enableJsonResponse || false,
      enableDnsRebindingProtection: httpConfig.enableDnsRebindingProtection || false,
      onsessioninitialized: (sessionId: string) => {
        this.logger.info('New MCP session initialized', { sessionId });
      },
    };

    // Only add allowedHosts and allowedOrigins if they are defined
    if (httpConfig.allowedHosts) {
      transportOptions.allowedHosts = httpConfig.allowedHosts;
    }
    if (httpConfig.allowedOrigins) {
      transportOptions.allowedOrigins = httpConfig.allowedOrigins;
    }

    this.httpTransport = new StreamableHTTPServerTransport(transportOptions);

    // Set up Express server for HTTP transport
    this.setupHttpServer();

    return this.httpTransport;
  }

  private setupHttpServer(): void {
    this.httpServer = express();

    // Security middleware
    this.httpServer.use(
      helmet({
        contentSecurityPolicy: false, // Disable CSP for MCP compatibility
      })
    );

    // CORS configuration
    if (this.config.cors) {
      this.httpServer.use(
        cors({
          origin: this.config.cors.allowedOrigins,
          allowedHeaders: this.config.cors.allowedHeaders,
          credentials: this.config.cors.credentials,
        })
      );
    }

    // Body parsing middleware
    this.httpServer.use(express.json({ limit: '10mb' }));

    // Health check endpoint
    this.httpServer.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'marketing-post-generator-mcp',
        version: process.env.npm_package_version || '1.0.0',
      });
    });

    // MCP endpoint - handle all MCP requests
    this.httpServer.all('/mcp', async (req, res) => {
      if (!this.httpTransport) {
        res.status(500).json({ error: 'HTTP transport not initialized' });
        return;
      }

      try {
        await this.httpTransport.handleRequest(req, res, req.body);
      } catch (error) {
        this.logger.error('Error handling MCP request', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    this.logger.info('HTTP server configured with MCP endpoint');
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Starting Marketing Post Generator MCP Server...');

      if (this.config.server.mode === 'remote' && this.httpServer) {
        // Start HTTP server for remote mode
        const port = this.config.server.port || 3000;
        const host = this.config.server.host || '0.0.0.0';

        await new Promise<void>((resolve, reject) => {
          const server = this.httpServer!.listen(port, host, () => {
            this.logger.info('HTTP server started', {
              port,
              host,
              healthCheck: `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/health`,
              mcpEndpoint: `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/mcp`,
            });
            resolve();
          });

          server.on('error', (error) => {
            this.logger.error('Failed to start HTTP server', { error });
            reject(error);
          });
        });
      } else {
        // Local mode with stdio transport starts automatically when connected
        this.logger.info('Server is ready to accept connections via stdio');
      }

      this.logger.info('Marketing Post Generator MCP Server started successfully', {
        mode: this.config.server.mode,
        transport: this.config.server.transport,
      });
    } catch (error) {
      this.logger.error('Failed to start server', { error });
      throw error;
    }
  }

  private async registerPrompts(): Promise<void> {
    try {
      // Register all prompt instances
      const promptInstances: PromptFactory[] = [
        new InitPrompt(),
        // Add more prompts here as they're implemented
      ];

      // Store prompts in legacy registry for O(1) lookup (backward compatibility)
      promptInstances.forEach((prompt) => {
        this.prompts.set(prompt.getPromptName(), prompt);
      });

      // Register prompts with the new registry system
      if (this.registry) {
        for (const prompt of promptInstances) {
          const promptDefinition = prompt.createPrompt();
          await this.registry.registerPrompt(
            promptDefinition,
            async (args: any) => await this.executePrompt(prompt, promptDefinition.name, args),
            {
              version: { major: 1, minor: 0, patch: 0 },
              author: 'Marketing Post Generator MCP',
              tags: ['prompt', 'marketing', 'content'],
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          );
        }
      }

      // Create prompt definitions for MCP registration (use registry if available)
      const promptDefinitions = this.registry
        ? this.registry.getPromptDefinitions()
        : promptInstances.map((prompt) => prompt.createPrompt());

      this.mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
        return {
          prompts: promptDefinitions,
        };
      });

      this.mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        // Try registry first, fallback to legacy method
        if (this.registry) {
          const registryEntry = this.registry.getPrompt(name);
          if (registryEntry) {
            const result = await this.registry.executePrompt(name, args);
            return {
              description: registryEntry.description,
              arguments: registryEntry.promptDefinition.parameters,
              messages: [
                {
                  role: 'user' as const,
                  content: {
                    type: 'text' as const,
                    text: result,
                  },
                },
              ],
            };
          }
        }

        // Fallback to legacy method
        const promptFactory = this.prompts.get(name);
        if (!promptFactory) {
          throw new Error(`Unknown prompt: ${name}`);
        }

        const promptDefinition = promptFactory.createPrompt();

        // Validate arguments based on prompt requirements
        this.validatePromptArguments(name, args);

        // Execute the prompt
        const result = await this.executePrompt(promptFactory, name, args);

        return {
          description: promptDefinition.description,
          arguments: promptDefinition.parameters,
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: result,
              },
            },
          ],
        };
      });

      this.logger.info('Prompts registered successfully', {
        registeredPrompts: promptDefinitions.map((p) => p.name),
      });
    } catch (error) {
      this.logger.error('Failed to register prompts', { error });
      throw error;
    }
  }

  private async registerTools(): Promise<void> {
    try {
      // Get services from DI container
      const searchService = this.container.resolve<SearchService>('SearchService');
      const logger = this.container.resolve<winston.Logger>('Logger');

      // Register all tool instances with dependency injection
      const toolInstances = [
        new SampleTool(searchService, logger),
        new SummarizeTool(searchService, logger),
        new GenerateToneTool(searchService, logger),
        new ContentPlanTool(searchService, logger),
        new NarrativeGeneratorTool(searchService, logger),
        new BlogPostGeneratorTool(searchService, logger),
        // Add more tools here as they're implemented
      ];

      // Store tools in legacy registry for O(1) lookup (backward compatibility)
      toolInstances.forEach((tool) => {
        this.tools.set(tool.getToolDefinition().name, tool);
      });

      // Register tools with the new registry system
      if (this.registry) {
        for (const tool of toolInstances) {
          const toolDefinition = tool.getToolDefinition();
          await this.registry.registerTool(
            toolDefinition,
            async (args: any) => {
              const claudeService = this.getClaudeService();
              return await tool.execute(args, claudeService);
            },
            {
              version: { major: 1, minor: 0, patch: 0 },
              author: 'Marketing Post Generator MCP',
              tags: ['tool', 'marketing', 'content'],
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          );
        }
      }

      // Create tool definitions for MCP registration (use registry if available)
      const toolDefinitions = this.registry
        ? this.registry.getToolDefinitions()
        : toolInstances.map((tool) => tool.getToolDefinition());

      this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: toolDefinitions,
        };
      });

      this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        // Try registry first, fallback to legacy method
        if (this.registry) {
          const registryEntry = this.registry.getTool(name);
          if (registryEntry) {
            const result = await this.registry.executeTool(name, args);
            return {
              content: [
                {
                  type: 'text' as const,
                  text: result,
                },
              ],
            };
          }
        }

        // Fallback to legacy method
        const tool = this.tools.get(name);
        if (!tool) {
          throw new Error(`Unknown tool: ${name}`);
        }

        // Get Claude service for tool execution
        const claudeService = this.getClaudeService();

        // TODO: Add runtime validation using the tool's input schema
        // const toolDefinition = tool.getToolDefinition();
        // Execute the tool with validated arguments
        const result = await tool.execute(args as Record<string, any>, claudeService);

        return {
          content: [
            {
              type: 'text' as const,
              text: result,
            },
          ],
        };
      });

      this.logger.info('Tools registered successfully', {
        registeredTools: toolDefinitions.map((t) => t.name),
      });
    } catch (error) {
      this.logger.error('Failed to register tools', { error });
      throw error;
    }
  }

  private validatePromptArguments(name: string, args: any): void {
    if (name === 'init') {
      if (
        !args ||
        typeof args !== 'object' ||
        !('domain' in args) ||
        typeof args.domain !== 'string'
      ) {
        throw new Error('Init prompt requires a "domain" argument');
      }
    }
    // Add validation for other prompts as they're implemented
  }

  private async executePrompt(
    promptFactory: PromptFactory,
    name: string,
    args: any
  ): Promise<string> {
    if (name === 'init') {
      const initPrompt = promptFactory as InitPrompt;
      return await initPrompt.executePrompt(args as { domain: string });
    }
    // Add execution logic for other prompts as they're implemented
    throw new Error(`Prompt execution not implemented for: ${name}`);
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Marketing Post Generator MCP Server...');

      // Close MCP server
      await this.mcpServer.close();

      // Close HTTP transport if it exists
      if (this.httpTransport) {
        await this.httpTransport.close();
      }

      // Note: Express server doesn't need explicit shutdown for our use case
      // since we're using the listen() callback pattern

      this.logger.info('Server stopped successfully');
    } catch (error) {
      this.logger.error('Error during server shutdown', { error });
      throw error;
    }
  }
}
