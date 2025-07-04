# Marketing Post Generator MCP - Architecture Document

## Executive Summary

The Marketing Post Generator MCP is a sophisticated AI-powered content generation system designed as a Model Context Protocol (MCP) server. It provides comprehensive tools for sampling blog content, extracting positioning and tone, creating content plans, and generating complete marketing blog posts. The system leverages Claude Code's agentic capabilities to deliver high-quality, contextually-aware content generation while maintaining strict separation of concerns through the MCP protocol.

### Key Architectural Decisions

1. **MCP-First Design**: Native implementation as an MCP server supporting both local (stdio) and remote (HTTP) modes
2. **Dual-Mode Operation**: Seamless support for both interactive and programmatic usage through Claude Code integration
3. **Dependency Injection Architecture**: Full dependency injection container for testing, modularity, and maintainability
4. **File-Based State Management**: Structured `.postgen` directory for persistent state with JSON-based data storage
5. **Strategy Pattern Implementation**: Pluggable content generation strategies and transport mechanisms
6. **Factory-Based Tool Registration**: Dynamic tool and prompt creation with automated MCP registration
7. **Clean Architecture Principles**: Separation of concerns with distinct layers for protocol, business logic, and data access

## System Overview

The Marketing Post Generator MCP operates as a sophisticated content generation pipeline that transforms domain analysis into high-quality marketing content. The system consists of five primary components that work together to deliver comprehensive content generation capabilities.

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP CLIENT LAYER                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Claude Code   │  │  Claude Desktop │  │  Custom Client  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ MCP Protocol (JSON-RPC)
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    MCP SERVER LAYER                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               Transport Layer                               │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                 │ │
│  │  │ Stdio Transport │  │  HTTP Transport │                 │ │
│  │  └─────────────────┘  └─────────────────┘                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │            Protocol Handler Layer                           │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │           Tool & Prompt Registry                        │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Dependency Injection
                                │
┌─────────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Content Tools  │  │  Analysis Tools │  │  Planning Tools │ │
│  │  ┌─────────────┐ │  │  ┌─────────────┐ │  │  ┌─────────────┐ │ │
│  │  │ Write Post  │ │  │  │   Sample    │ │  │  │Content Plan │ │ │
│  │  │ Narrative   │ │  │  │ Summarize   │ │  │  │    Init     │ │ │
│  │  │             │ │  │  │Generate Tone│ │  │  │             │ │ │
│  │  └─────────────┘ │  │  └─────────────┘ │  │  └─────────────┘ │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Service Interfaces
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Claude Service │  │  Content Service│  │ Storage Service │ │
│  │  ┌─────────────┐ │  │  ┌─────────────┐ │  │  ┌─────────────┐ │ │
│  │  │AI Generation│ │  │  │Web Scraping │ │  │  │File Manager │ │ │
│  │  │Rate Limiting│ │  │  │Content Parse│ │  │  │Data Persist │ │ │
│  │  │Error Retry  │ │  │  │URL Validate │ │  │  │Cache Layer  │ │ │
│  │  └─────────────┘ │  │  └─────────────┘ │  │  └─────────────┘ │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ File System Interface
                                │
┌─────────────────────────────────────────────────────────────────┐
│                   DATA PERSISTENCE LAYER                        │
│              .postgen Directory Structure                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │   config/   │ │  samples/   │ │ summaries/  │ │   posts/  │ │
│  │ summaries/  │ │content-plans/│ │tone-analysis/│ │narratives/│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Data Flow

1. **Initialization**: Client invokes `init` prompt to establish `.postgen` directory structure
2. **Analysis Phase**: Tools sample domain content and extract positioning/tone characteristics
3. **Planning Phase**: Content plan generation based on analysis and strategic requirements
4. **Generation Phase**: Narrative creation and full blog post generation from plans
5. **Persistence**: All artifacts stored in structured `.postgen` directory for future reference

## Technical Architecture

### Core Technology Stack

- **Runtime**: Node.js 18+ with TypeScript 5.0+ for type safety and modern JavaScript features
- **MCP Implementation**: `@modelcontextprotocol/sdk` for native MCP server capabilities
- **AI Integration**: `@anthropic-ai/claude-code` for agentic content generation operations
- **Module System**: ES Modules (ESM) for modern JavaScript compatibility
- **Build System**: TypeScript compiler with `target: ES2022` and `moduleResolution: Node16`
- **Container Support**: Docker with multi-stage builds for production deployment

### Architectural Patterns Applied

#### 1. Dependency Injection Container

```typescript
// Core DI container implementation
export class DIContainer {
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();
  
  register<T>(token: string, factory: () => T): void {
    this.factories.set(token, factory);
  }
  
  resolve<T>(token: string): T {
    if (this.services.has(token)) {
      return this.services.get(token);
    }
    
    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`Service not registered: ${token}`);
    }
    
    const instance = factory();
    this.services.set(token, instance);
    return instance;
  }
}

// Service registration
container.register('ClaudeService', () => new ClaudeService(config.claude.apiKey));
container.register('StorageService', () => new StorageService(config.postgen.dataDir));
container.register('ContentService', () => new ContentService());
```

#### 2. Factory Pattern for Tool Creation

```typescript
// Tool factory interface
export interface ToolFactory {
  createTool(): MCPTool;
  getToolName(): string;
  getToolDescription(): string;
}

// Concrete tool factory
export class SampleToolFactory implements ToolFactory {
  constructor(
    private claudeService: ClaudeService,
    private storageService: StorageService,
    private contentService: ContentService
  ) {}
  
  createTool(): MCPTool {
    return {
      name: 'marketing_post_generator_mcp__sample',
      description: 'Sample blog posts from a domain to extract positioning and tone',
      parameters: this.getParameterSchema(),
      handler: this.createHandler()
    };
  }
  
  private createHandler() {
    return async (params: any, context: any) => {
      // Implementation with injected dependencies
    };
  }
}
```

#### 3. Strategy Pattern for Content Generation

```typescript
// Content generation strategy interface
export interface ContentGenerationStrategy {
  generate(context: GenerationContext): Promise<GeneratedContent>;
  supports(contentType: ContentType): boolean;
}

// Concrete strategies
export class BlogPostStrategy implements ContentGenerationStrategy {
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Blog post generation logic
  }
  
  supports(contentType: ContentType): boolean {
    return contentType === ContentType.BLOG_POST;
  }
}

export class NarrativeStrategy implements ContentGenerationStrategy {
  async generate(context: GenerationContext): Promise<GeneratedContent> {
    // Narrative generation logic
  }
  
  supports(contentType: ContentType): boolean {
    return contentType === ContentType.NARRATIVE;
  }
}

// Strategy selector
export class ContentGenerationEngine {
  constructor(private strategies: ContentGenerationStrategy[]) {}
  
  async generate(contentType: ContentType, context: GenerationContext): Promise<GeneratedContent> {
    const strategy = this.strategies.find(s => s.supports(contentType));
    if (!strategy) {
      throw new Error(`No strategy found for content type: ${contentType}`);
    }
    
    return strategy.generate(context);
  }
}
```

#### 4. Repository Pattern for Data Access

```typescript
// Repository interface
export interface Repository<T> {
  save(entity: T): Promise<void>;
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  delete(id: string): Promise<void>;
}

// Concrete repository implementation
export class FileSystemRepository<T> implements Repository<T> {
  constructor(
    private baseDirectory: string,
    private serializer: Serializer<T>
  ) {}
  
  async save(entity: T): Promise<void> {
    const filePath = this.getFilePath(entity.id);
    const data = this.serializer.serialize(entity);
    await fs.writeFile(filePath, data, 'utf-8');
  }
  
  async findById(id: string): Promise<T | null> {
    try {
      const filePath = this.getFilePath(id);
      const data = await fs.readFile(filePath, 'utf-8');
      return this.serializer.deserialize(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}
```

#### 5. Observer Pattern for Event Handling

```typescript
// Event system for cross-component communication
export interface Event {
  type: string;
  payload: any;
  timestamp: Date;
}

export interface EventSubscriber<T = any> {
  handle(event: Event<T>): Promise<void>;
}

export class EventBus {
  private subscribers = new Map<string, EventSubscriber[]>();
  
  subscribe<T>(eventType: string, subscriber: EventSubscriber<T>): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(subscriber);
  }
  
  async publish<T>(event: Event<T>): Promise<void> {
    const subscribers = this.subscribers.get(event.type) || [];
    await Promise.all(subscribers.map(subscriber => subscriber.handle(event)));
  }
}
```

## Component Design

### MCP Server Core

The MCP server core implements the Model Context Protocol specification and manages the lifecycle of tools and prompts.

```typescript
export class MarketingPostGeneratorServer {
  private mcpServer: MCPServer;
  private toolRegistry: ToolRegistry;
  private promptRegistry: PromptRegistry;
  private container: DIContainer;
  private eventBus: EventBus;
  
  constructor(private config: ServerConfig) {
    this.container = new DIContainer();
    this.eventBus = new EventBus();
    this.initializeDependencies();
    this.initializeMCPServer();
  }
  
  private initializeDependencies(): void {
    // Register all services with the DI container
    this.container.register('ClaudeService', () => 
      new ClaudeService(this.config.claude.apiKey, this.eventBus)
    );
    
    this.container.register('StorageService', () => 
      new StorageService(this.config.postgen.dataDir, this.eventBus)
    );
    
    this.container.register('ContentService', () => 
      new ContentService(this.eventBus)
    );
  }
  
  private initializeMCPServer(): void {
    const transport = this.createTransport();
    this.mcpServer = new MCPServer(transport);
    
    this.toolRegistry = new ToolRegistry(this.mcpServer, this.container);
    this.promptRegistry = new PromptRegistry(this.mcpServer, this.container);
    
    this.registerToolsAndPrompts();
  }
  
  private createTransport(): Transport {
    switch (this.config.server.mode) {
      case 'local':
        return new StdioServerTransport();
      case 'remote':
        return new StreamableHTTPServerTransport({
          port: this.config.server.port,
          cors: {
            allowedOrigins: this.config.cors.allowedOrigins,
            allowedHeaders: ['mcp-session-id', 'content-type']
          }
        });
      default:
        throw new Error(`Unsupported server mode: ${this.config.server.mode}`);
    }
  }
}
```

### Claude Integration Service

The Claude service manages all interactions with the Claude Code SDK, implementing proper error handling, rate limiting, and retry logic.

```typescript
export class ClaudeService {
  private claude: Claude;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  
  constructor(
    apiKey: string,
    private eventBus: EventBus,
    private config: ClaudeConfig = DEFAULT_CLAUDE_CONFIG
  ) {
    this.claude = new Claude({ apiKey });
    this.rateLimiter = new RateLimiter(config.rateLimits);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
  }
  
  async generateContent(
    prompt: string,
    options: ContentGenerationOptions = {}
  ): Promise<GeneratedContent> {
    // Rate limiting check
    if (!this.rateLimiter.checkLimit()) {
      throw new RateLimitError('Rate limit exceeded');
    }
    
    // Circuit breaker check
    if (this.circuitBreaker.isOpen()) {
      throw new ServiceUnavailableError('Claude service temporarily unavailable');
    }
    
    try {
      const startTime = Date.now();
      
      // Publish generation started event
      await this.eventBus.publish({
        type: 'content.generation.started',
        payload: { prompt: prompt.substring(0, 100) + '...', options },
        timestamp: new Date()
      });
      
      const response = await this.claude.complete({
        prompt,
        max_tokens: options.maxTokens || 2000,
        temperature: options.temperature || 0.7,
        model: options.model || 'claude-3-5-sonnet-latest'
      });
      
      const duration = Date.now() - startTime;
      
      // Publish generation completed event
      await this.eventBus.publish({
        type: 'content.generation.completed',
        payload: { 
          tokenCount: response.usage?.total_tokens,
          duration,
          success: true
        },
        timestamp: new Date()
      });
      
      this.circuitBreaker.recordSuccess();
      
      return {
        content: response.completion,
        metadata: {
          model: response.model,
          usage: response.usage,
          duration
        }
      };
      
    } catch (error) {
      this.circuitBreaker.recordFailure();
      
      await this.eventBus.publish({
        type: 'content.generation.failed',
        payload: { error: error.message },
        timestamp: new Date()
      });
      
      throw new ContentGenerationError(`Failed to generate content: ${error.message}`, error);
    }
  }
}
```

### Storage Service Implementation

The storage service provides abstracted access to the file system with caching, validation, and atomic operations.

```typescript
export class StorageService {
  private cache: LRUCache<string, any>;
  private lockManager: LockManager;
  
  constructor(
    private baseDirectory: string,
    private eventBus: EventBus,
    private config: StorageConfig = DEFAULT_STORAGE_CONFIG
  ) {
    this.cache = new LRUCache({
      maxSize: config.cacheSize,
      ttl: config.cacheTtl
    });
    this.lockManager = new LockManager();
  }
  
  async ensureInitialized(): Promise<void> {
    try {
      await fs.access(this.baseDirectory);
    } catch (error) {
      throw new StorageError(`Storage directory not initialized: ${this.baseDirectory}`);
    }
  }
  
  async writeData<T>(
    category: string,
    filename: string,
    data: T,
    options: WriteOptions = {}
  ): Promise<void> {
    const filePath = path.join(this.baseDirectory, category, filename);
    const lockKey = `write:${filePath}`;
    
    await this.lockManager.acquire(lockKey);
    
    try {
      await this.ensureDirectoryExists(path.dirname(filePath));
      
      // Atomic write operation
      const tempPath = `${filePath}.tmp`;
      const serializedData = JSON.stringify(data, null, 2);
      
      await fs.writeFile(tempPath, serializedData, 'utf-8');
      await fs.rename(tempPath, filePath);
      
      // Update cache
      const cacheKey = `${category}:${filename}`;
      this.cache.set(cacheKey, data);
      
      // Publish event
      await this.eventBus.publish({
        type: 'storage.data.written',
        payload: { category, filename, size: serializedData.length },
        timestamp: new Date()
      });
      
    } finally {
      this.lockManager.release(lockKey);
    }
  }
  
  async readData<T>(
    category: string,
    filename: string,
    options: ReadOptions = {}
  ): Promise<T | null> {
    const cacheKey = `${category}:${filename}`;
    
    // Check cache first
    if (!options.bypassCache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const filePath = path.join(this.baseDirectory, category, filename);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Update cache
      this.cache.set(cacheKey, parsed);
      
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new StorageError(`Failed to read data: ${error.message}`, error);
    }
  }
}
```

### Tool and Prompt Registration System

The registration system provides centralized management of all MCP tools and prompts with validation and lifecycle management.

```typescript
export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  private factories = new Map<string, ToolFactory>();
  
  constructor(
    private mcpServer: MCPServer,
    private container: DIContainer
  ) {}
  
  registerFactory(factory: ToolFactory): void {
    const toolName = factory.getToolName();
    this.factories.set(toolName, factory);
    
    // Create and register the tool
    const tool = factory.createTool();
    this.registerTool(tool, factory);
  }
  
  private registerTool(tool: MCPTool, factory: ToolFactory): void {
    // Validate tool structure
    this.validateTool(tool);
    
    // Wrap handler with middleware
    const wrappedTool = {
      ...tool,
      handler: this.wrapHandler(tool.handler, tool.name)
    };
    
    // Register with MCP server
    this.mcpServer.registerTool(wrappedTool);
    
    // Store in registry
    this.tools.set(tool.name, {
      tool: wrappedTool,
      factory,
      registeredAt: new Date()
    });
    
    logger.info(`Tool registered: ${tool.name}`);
  }
  
  private wrapHandler(originalHandler: Function, toolName: string) {
    return async (params: any, context: any) => {
      const startTime = Date.now();
      const requestId = crypto.randomUUID();
      
      logger.info(`Tool execution started: ${toolName}`, { requestId, params });
      
      try {
        // Inject services from container
        const enhancedContext = {
          ...context,
          claudeService: this.container.resolve('ClaudeService'),
          storageService: this.container.resolve('StorageService'),
          contentService: this.container.resolve('ContentService'),
          requestId
        };
        
        const result = await originalHandler(params, enhancedContext);
        
        const duration = Date.now() - startTime;
        logger.info(`Tool execution completed: ${toolName}`, { requestId, duration });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Tool execution failed: ${toolName}`, { 
          requestId, 
          duration, 
          error: error.message 
        });
        
        throw new ToolExecutionError(
          `Tool ${toolName} failed: ${error.message}`,
          toolName,
          error
        );
      }
    };
  }
  
  private validateTool(tool: MCPTool): void {
    if (!tool.name || !tool.description || !tool.handler) {
      throw new ValidationError('Tool missing required properties');
    }
    
    if (!tool.name.startsWith('marketing_post_generator_mcp__')) {
      throw new ValidationError(`Tool name must start with 'marketing_post_generator_mcp__': ${tool.name}`);
    }
    
    if (this.tools.has(tool.name)) {
      throw new ValidationError(`Tool already registered: ${tool.name}`);
    }
  }
}
```

## Data Architecture

### File Structure Design

The `.postgen` directory provides a structured approach to data persistence with clear separation of concerns:

```
.postgen/
├── config.json                    # Domain configuration and metadata
├── samples/                       # Domain sampling results
│   ├── {domain}-{timestamp}.json  # Sample analysis per domain
│   └── cache/                     # Cached sample data
├── summaries/                     # Individual post summaries
│   ├── {url-hash}.json           # Summary per URL
│   └── index.json                # Summary index
├── tone-analysis/                 # Tone and positioning analysis
│   ├── domain-{timestamp}.json   # Domain-wide tone analysis
│   └── post-{timestamp}.json     # Individual post tone analysis
├── content-plans/                 # Strategic content planning
│   ├── {domain}-{plan-id}.json   # Content plan per domain
│   └── templates/                # Plan templates
├── narratives/                    # Post narrative outlines
│   ├── {post-id}-{timestamp}.json # Narrative per planned post
│   └── drafts/                   # Draft narratives
└── posts/                        # Generated blog posts
    ├── {post-id}.md              # Final blog post content
    ├── {post-id}.json            # Post metadata
    └── archive/                  # Archived posts
```

### Data Models

```typescript
// Core domain configuration
export interface DomainConfig {
  domain: string;
  initialized: string;
  lastSampled?: string;
  samplingPreferences: {
    sampleSize: number;
    excludePatterns: string[];
    contentTypes: string[];
  };
  generationSettings: {
    defaultWordCount: number;
    preferredStyle: string;
    keywordStrategy: string;
  };
}

// Content sampling result
export interface SampleResult {
  domain: string;
  sampleSize: number;
  posts: Array<{
    title: string;
    url: string;
    publishDate?: string;
    wordCount?: number;
    excerpt: string;
  }>;
  analysis: {
    positioning: string;
    toneOfVoice: string;
    contentStrategy: string;
    keywordPatterns: string[];
    structuralPatterns: string[];
  };
  metadata: {
    sampledAt: string;
    processingDuration: number;
    confidence: number;
  };
}

// Content plan structure
export interface ContentPlan {
  domain: string;
  timeframe: 'week' | 'month' | 'quarter';
  posts: Array<{
    id: string;
    title: string;
    topic: string;
    keywords: string[];
    estimatedWordCount: number;
    targetPublishDate?: string;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
  }>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: number;
  };
}

// Generated content structure
export interface GeneratedPost {
  id: string;
  title: string;
  content: string;
  metadata: {
    wordCount: number;
    readingTime: number;
    keywords: string[];
    tone: string;
    style: string;
    generatedAt: string;
    model: string;
    revisionCount: number;
  };
  frontmatter: {
    title: string;
    description: string;
    tags: string[];
    publishDate?: string;
    lastModified: string;
  };
}
```

### Caching Strategy

```typescript
export class CacheManager {
  private memoryCache: LRUCache<string, any>;
  private diskCache: DiskCache;
  
  constructor(config: CacheConfig) {
    this.memoryCache = new LRUCache({
      maxSize: config.memoryCacheSize,
      ttl: config.memoryCacheTtl
    });
    this.diskCache = new DiskCache(config.diskCacheDirectory);
  }
  
  async get<T>(key: string, loader: () => Promise<T>): Promise<T> {
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }
    
    // Check disk cache
    const diskResult = await this.diskCache.get<T>(key);
    if (diskResult) {
      this.memoryCache.set(key, diskResult.data);
      return diskResult.data;
    }
    
    // Load from source
    const data = await loader();
    
    // Store in both caches
    this.memoryCache.set(key, data);
    await this.diskCache.set(key, data);
    
    return data;
  }
  
  async invalidate(pattern: string): Promise<void> {
    // Invalidate memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.match(pattern)) {
        this.memoryCache.delete(key);
      }
    }
    
    // Invalidate disk cache
    await this.diskCache.invalidatePattern(pattern);
  }
}
```

## Security Architecture

### API Key Management

```typescript
export class ApiKeyManager {
  private keyStore: Map<string, ApiKey> = new Map();
  private rotationScheduler: RotationScheduler;
  
  constructor(private config: SecurityConfig) {
    this.rotationScheduler = new RotationScheduler(config.keyRotation);
  }
  
  async getApiKey(service: string): Promise<string> {
    const apiKey = this.keyStore.get(service);
    if (!apiKey) {
      throw new SecurityError(`API key not found for service: ${service}`);
    }
    
    if (this.isKeyExpired(apiKey)) {
      throw new SecurityError(`API key expired for service: ${service}`);
    }
    
    return apiKey.value;
  }
  
  async rotateKey(service: string): Promise<void> {
    const newKey = await this.generateNewKey(service);
    this.keyStore.set(service, newKey);
    
    logger.info(`API key rotated for service: ${service}`);
  }
  
  private isKeyExpired(apiKey: ApiKey): boolean {
    return Date.now() > apiKey.expiresAt;
  }
}
```

### Rate Limiting Implementation

```typescript
export class RateLimiter {
  private windows = new Map<string, RateLimitWindow>();
  
  constructor(private config: RateLimitConfig) {}
  
  async checkLimit(key: string, action: string): Promise<RateLimitResult> {
    const windowKey = `${key}:${action}`;
    const now = Date.now();
    
    let window = this.windows.get(windowKey);
    if (!window || now > window.resetAt) {
      window = {
        count: 0,
        resetAt: now + this.config.windowSize,
        maxRequests: this.config.actions[action]?.maxRequests || this.config.default.maxRequests
      };
      this.windows.set(windowKey, window);
    }
    
    if (window.count >= window.maxRequests) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetAt: window.resetAt,
        retryAfter: window.resetAt - now
      };
    }
    
    window.count++;
    
    return {
      allowed: true,
      remainingRequests: window.maxRequests - window.count,
      resetAt: window.resetAt,
      retryAfter: 0
    };
  }
}
```

### Input Validation

```typescript
export class InputValidator {
  static validateDomain(domain: string): void {
    try {
      const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
      
      if (!url.hostname) {
        throw new ValidationError('Invalid domain: missing hostname');
      }
      
      if (url.hostname.length > 253) {
        throw new ValidationError('Invalid domain: hostname too long');
      }
      
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(url.hostname)) {
        throw new ValidationError('Invalid domain: invalid characters');
      }
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Invalid domain format: ${domain}`);
    }
  }
  
  static validateContentParameters(params: ContentParameters): void {
    if (params.wordCount && (params.wordCount < 100 || params.wordCount > 5000)) {
      throw new ValidationError('Word count must be between 100 and 5000');
    }
    
    if (params.keywords && params.keywords.length > 20) {
      throw new ValidationError('Maximum 20 keywords allowed');
    }
    
    if (params.title && params.title.length > 200) {
      throw new ValidationError('Title must be 200 characters or less');
    }
  }
}
```

## Deployment Architecture

### Local Deployment

Local deployment utilizes stdio transport for direct integration with Claude Code and other MCP-compatible clients.

```typescript
// Local configuration
export const localConfig: ServerConfig = {
  server: {
    mode: 'local',
    transport: 'stdio'
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY!,
    model: 'claude-3-5-sonnet-latest',
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerHour: 100000
    }
  },
  postgen: {
    dataDir: '.postgen',
    cacheEnabled: true,
    cacheTtl: 3600000 // 1 hour
  },
  logging: {
    level: 'info',
    format: 'simple'
  }
};
```

### Remote Deployment

Remote deployment supports HTTP transport with SSE for real-time communication and CORS configuration for web clients.

```typescript
// Remote configuration
export const remoteConfig: ServerConfig = {
  server: {
    mode: 'remote',
    transport: 'http',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0'
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    allowedHeaders: ['mcp-session-id', 'content-type', 'authorization'],
    credentials: true
  },
  security: {
    enableRateLimit: true,
    rateLimits: {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      keyGenerator: (req) => req.ip
    },
    enableCors: true,
    trustProxy: true
  }
};
```

### Container Deployment

```dockerfile
# Multi-stage Docker build for optimized production images
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Security hardening
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpserver -u 1001 -G nodejs

WORKDIR /app

# Copy production dependencies and built application
COPY --from=builder --chown=mcpserver:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcpserver:nodejs /app/dist ./dist
COPY --from=builder --chown=mcpserver:nodejs /app/package*.json ./

# Create data directory
RUN mkdir -p /data/.postgen && \
    chown -R mcpserver:nodejs /data

# Security: run as non-root user
USER mcpserver

# Environment configuration
ENV NODE_ENV=production
ENV MCP_MODE=remote
ENV MCP_PORT=3000
ENV POSTGEN_DATA_DIR=/data/.postgen

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  marketing-post-generator:
    build:
      context: .
      target: production
    ports:
      - "${PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
      - MCP_MODE=remote
      - MCP_PORT=3000
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - POSTGEN_DATA_DIR=/data/.postgen
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      - postgen-data:/data/.postgen
      - logs:/app/logs
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped
    networks:
      - mcp-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'

  # Optional: Monitoring stack
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    networks:
      - mcp-network

volumes:
  postgen-data:
    driver: local
  logs:
    driver: local
  prometheus-data:
    driver: local

networks:
  mcp-network:
    driver: bridge
```

## API Design

### MCP Tools Specification

#### Initialize Tool
```typescript
{
  name: 'marketing_post_generator_mcp__init',
  description: 'Initialize the Marketing Post Generator with a blog domain',
  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'The domain/URL of the main blog page',
        pattern: '^https?://[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*'
      }
    },
    required: ['domain']
  }
}
```

#### Sample Tool
```typescript
{
  name: 'marketing_post_generator_mcp__sample',
  description: 'Sample blog posts from a domain to extract positioning, tone, and content strategy',
  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'The domain to sample from'
      },
      sampleSize: {
        type: 'number',
        description: 'Number of posts to sample',
        minimum: 1,
        maximum: 20,
        default: 5
      },
      contentTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Types of content to include',
        default: ['blog', 'article']
      }
    },
    required: ['domain']
  }
}
```

#### Content Plan Tool
```typescript
{
  name: 'marketing_post_generator_mcp__content_plan',
  description: 'Create or update a content plan for future blog posts',
  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'The domain to create a content plan for'
      },
      timeframe: {
        type: 'string',
        enum: ['week', 'month', 'quarter'],
        description: 'Timeframe for the content plan',
        default: 'month'
      },
      postCount: {
        type: 'number',
        description: 'Number of posts to plan',
        minimum: 1,
        maximum: 50,
        default: 4
      },
      updateExisting: {
        type: 'boolean',
        description: 'Whether to update an existing plan',
        default: false
      },
      focusAreas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific focus areas or topics'
      }
    },
    required: ['domain']
  }
}
```

#### Write Post Tool
```typescript
{
  name: 'marketing_post_generator_mcp__write_post',
  description: 'Write a complete blog post from scratch or based on a narrative',
  parameters: {
    type: 'object',
    properties: {
      narrativeId: {
        type: 'string',
        description: 'ID of the narrative to base the post on'
      },
      title: {
        type: 'string',
        description: 'Title of the blog post',
        maxLength: 200
      },
      topic: {
        type: 'string',
        description: 'Topic of the blog post'
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Keywords for the blog post',
        maxItems: 20
      },
      wordCount: {
        type: 'number',
        description: 'Target word count for the post',
        minimum: 100,
        maximum: 5000,
        default: 1000
      },
      style: {
        type: 'string',
        enum: ['informative', 'persuasive', 'storytelling', 'technical', 'conversational'],
        description: 'Writing style for the post',
        default: 'informative'
      }
    },
    anyOf: [
      { required: ['narrativeId'] },
      { required: ['title', 'topic'] }
    ]
  }
}
```

### MCP Prompts Specification

#### Initialize Prompt
```typescript
{
  name: 'marketing_post_generator_mcp__init',
  description: 'Initialize the Marketing Post Generator workspace',
  arguments: [
    {
      name: 'domain',
      description: 'The blog domain to initialize with',
      required: true
    }
  ]
}
```

#### Quick Sample Prompt
```typescript
{
  name: 'marketing_post_generator_mcp__quick_sample',
  description: 'Quickly sample a domain and provide analysis summary',
  arguments: [
    {
      name: 'domain',
      description: 'The domain to sample',
      required: true
    },
    {
      name: 'count',
      description: 'Number of posts to sample',
      required: false
    }
  ]
}
```

### Response Formats

```typescript
// Standard success response
interface SuccessResponse<T = any> {
  success: true;
  data: T;
  metadata: {
    requestId: string;
    processingTime: number;
    timestamp: string;
  };
}

// Standard error response
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    requestId: string;
    timestamp: string;
  };
}

// Streaming response (for long-running operations)
interface StreamResponse {
  type: 'progress' | 'data' | 'complete' | 'error';
  payload: any;
  metadata: {
    requestId: string;
    timestamp: string;
    progress?: number;
  };
}
```

## Error Handling & Resilience

### Error Hierarchy

```typescript
// Base error class
export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  
  constructor(
    message: string,
    public readonly context?: any,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack
    };
  }
}

// Specific error types
export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class ContentGenerationError extends BaseError {
  readonly code = 'CONTENT_GENERATION_ERROR';
  readonly statusCode = 500;
}

export class StorageError extends BaseError {
  readonly code = 'STORAGE_ERROR';
  readonly statusCode = 500;
}

export class RateLimitError extends BaseError {
  readonly code = 'RATE_LIMIT_ERROR';
  readonly statusCode = 429;
}

export class ServiceUnavailableError extends BaseError {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly statusCode = 503;
}
```

### Circuit Breaker Implementation

```typescript
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;
  
  constructor(private config: CircuitBreakerConfig) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new ServiceUnavailableError('Circuit breaker is open');
      }
      this.state = CircuitBreakerState.HALF_OPEN;
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitBreakerState.CLOSED;
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.timeout;
    }
  }
  
  isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }
}
```

### Retry Logic with Exponential Backoff

```typescript
export class RetryHandler {
  async execute<T>(
    operation: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry for certain error types
        if (!this.shouldRetry(error, attempt, config)) {
          throw error;
        }
        
        if (attempt < config.maxAttempts) {
          const delay = this.calculateDelay(attempt, config);
          await this.sleep(delay);
        }
      }
    }
    
    throw new Error(`Operation failed after ${config.maxAttempts} attempts: ${lastError.message}`);
  }
  
  private shouldRetry(error: Error, attempt: number, config: RetryConfig): boolean {
    // Don't retry validation errors
    if (error instanceof ValidationError) {
      return false;
    }
    
    // Don't retry rate limit errors (handle them differently)
    if (error instanceof RateLimitError) {
      return false;
    }
    
    // Don't retry if we've hit max attempts
    if (attempt >= config.maxAttempts) {
      return false;
    }
    
    // Check if error type is retryable
    return config.retryableErrors.some(errorType => error instanceof errorType);
  }
  
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(2, attempt - 1);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5);
    return Math.min(jitteredDelay, config.maxDelay);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Comprehensive Error Handling Middleware

```typescript
export class ErrorHandlingMiddleware {
  constructor(
    private logger: Logger,
    private metrics: MetricsCollector
  ) {}
  
  async handleError(error: Error, context: ErrorContext): Promise<ErrorResponse> {
    const requestId = context.requestId || crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    // Log the error
    this.logger.error('Error occurred', {
      requestId,
      error: error.message,
      stack: error.stack,
      context
    });
    
    // Update metrics
    this.metrics.incrementErrorCounter({
      errorType: error.constructor.name,
      tool: context.toolName,
      statusCode: this.getStatusCode(error)
    });
    
    // Determine response based on error type
    if (error instanceof BaseError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: this.sanitizeErrorMessage(error.message),
          details: error.context
        },
        metadata: {
          requestId,
          timestamp
        }
      };
    }
    
    // Handle unexpected errors
    this.logger.error('Unexpected error', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      },
      metadata: {
        requestId,
        timestamp
      }
    };
  }
  
  private sanitizeErrorMessage(message: string): string {
    // Remove sensitive information from error messages
    return message
      .replace(/api[_-]?key[s]?[:\s]*[a-zA-Z0-9]+/gi, 'api_key:***')
      .replace(/token[s]?[:\s]*[a-zA-Z0-9]+/gi, 'token:***')
      .replace(/password[s]?[:\s]*[^\s]+/gi, 'password:***');
  }
  
  private getStatusCode(error: Error): number {
    if (error instanceof BaseError) {
      return error.statusCode;
    }
    return 500;
  }
}
```

## Performance & Scalability

### Caching Strategy

```typescript
export class PerformanceOptimizer {
  private memoryCache: LRUCache<string, any>;
  private compressionCache: CompressionCache;
  
  constructor(config: PerformanceConfig) {
    this.memoryCache = new LRUCache({
      maxSize: config.memoryCacheSize,
      ttl: config.memoryCacheTtl,
      updateAgeOnGet: true
    });
    
    this.compressionCache = new CompressionCache({
      compressionLevel: config.compressionLevel,
      threshold: config.compressionThreshold
    });
  }
  
  async getCachedContent(
    key: string,
    generator: () => Promise<any>,
    options: CacheOptions = {}
  ): Promise<any> {
    const cacheKey = this.buildCacheKey(key, options);
    
    // Check memory cache first
    const memoryResult = this.memoryCache.get(cacheKey);
    if (memoryResult) {
      return memoryResult;
    }
    
    // Check compression cache for larger items
    if (options.useCompression) {
      const compressedResult = await this.compressionCache.get(cacheKey);
      if (compressedResult) {
        this.memoryCache.set(cacheKey, compressedResult);
        return compressedResult;
      }
    }
    
    // Generate content
    const content = await generator();
    
    // Store in appropriate cache
    this.memoryCache.set(cacheKey, content);
    
    if (options.useCompression && this.shouldCompress(content)) {
      await this.compressionCache.set(cacheKey, content);
    }
    
    return content;
  }
  
  private buildCacheKey(key: string, options: CacheOptions): string {
    const hash = crypto.createHash('md5');
    hash.update(key);
    hash.update(JSON.stringify(options));
    return hash.digest('hex');
  }
  
  private shouldCompress(content: any): boolean {
    const size = JSON.stringify(content).length;
    return size > this.compressionCache.threshold;
  }
}
```

### Connection Pooling

```typescript
export class ConnectionPool {
  private pool: Connection[] = [];
  private activeConnections = 0;
  private waitingQueue: Array<{
    resolve: (connection: Connection) => void;
    reject: (error: Error) => void;
  }> = [];
  
  constructor(private config: PoolConfig) {
    this.initializePool();
  }
  
  async acquire(): Promise<Connection> {
    // Check for available connection
    const availableConnection = this.pool.find(conn => !conn.inUse);
    if (availableConnection) {
      availableConnection.inUse = true;
      this.activeConnections++;
      return availableConnection;
    }
    
    // Create new connection if under limit
    if (this.pool.length < this.config.maxConnections) {
      const connection = await this.createConnection();
      this.pool.push(connection);
      connection.inUse = true;
      this.activeConnections++;
      return connection;
    }
    
    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection acquisition timeout'));
      }, this.config.acquireTimeout);
      
      this.waitingQueue.push({
        resolve: (connection) => {
          clearTimeout(timeout);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }
  
  release(connection: Connection): void {
    connection.inUse = false;
    this.activeConnections--;
    
    // Serve waiting requests
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift()!;
      connection.inUse = true;
      this.activeConnections++;
      waiter.resolve(connection);
    }
  }
  
  async destroy(): Promise<void> {
    // Close all connections
    await Promise.all(this.pool.map(conn => conn.close()));
    this.pool = [];
    this.activeConnections = 0;
    
    // Reject waiting requests
    this.waitingQueue.forEach(waiter => {
      waiter.reject(new Error('Connection pool destroyed'));
    });
    this.waitingQueue = [];
  }
  
  getStats(): PoolStats {
    return {
      totalConnections: this.pool.length,
      activeConnections: this.activeConnections,
      availableConnections: this.pool.length - this.activeConnections,
      waitingRequests: this.waitingQueue.length
    };
  }
}
```

### Memory Management

```typescript
export class MemoryManager {
  private gcScheduler: NodeJS.Timeout;
  private memoryThreshold: number;
  
  constructor(config: MemoryConfig) {
    this.memoryThreshold = config.threshold;
    this.scheduleGarbageCollection(config.gcInterval);
    this.setupMemoryMonitoring();
  }
  
  private scheduleGarbageCollection(interval: number): void {
    this.gcScheduler = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      
      if (heapUsedMB > this.memoryThreshold) {
        logger.info('Memory threshold exceeded, forcing garbage collection', {
          heapUsed: heapUsedMB,
          threshold: this.memoryThreshold
        });
        
        if (global.gc) {
          global.gc();
        }
      }
    }, interval);
  }
  
  private setupMemoryMonitoring(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      
      logger.debug('Memory usage', {
        rss: Math.round(usage.rss / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024)
      });
      
      // Alert if memory usage is high
      if (usage.heapUsed / usage.heapTotal > 0.9) {
        logger.warn('High memory usage detected', {
          heapUtilization: Math.round((usage.heapUsed / usage.heapTotal) * 100)
        });
      }
    }, 30000); // Check every 30 seconds
  }
  
  destroy(): void {
    if (this.gcScheduler) {
      clearInterval(this.gcScheduler);
    }
  }
}
```

## Development Guidelines

### Code Standards

```typescript
// ESLint configuration
module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error'
  }
};

// Prettier configuration
module.exports = {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false
};
```

### Testing Strategy

```typescript
// Jest configuration for comprehensive testing
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000
};

// Test utilities
export class TestHelper {
  static createMockClaudeService(): jest.Mocked<ClaudeService> {
    return {
      generateContent: jest.fn(),
      healthCheck: jest.fn(),
      getRemainingQuota: jest.fn()
    } as jest.Mocked<ClaudeService>;
  }
  
  static createMockStorageService(): jest.Mocked<StorageService> {
    return {
      writeData: jest.fn(),
      readData: jest.fn(),
      deleteData: jest.fn(),
      ensureInitialized: jest.fn()
    } as jest.Mocked<StorageService>;
  }
  
  static async createTempDirectory(): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `mcp-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }
  
  static async cleanupTempDirectory(tempDir: string): Promise<void> {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
```

### CI/CD Pipeline

```yaml
# GitHub Actions workflow
name: CI/CD Pipeline

on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
  
  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18.x
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
    
    - name: Build Docker image
      run: docker build -t marketing-post-generator:${{ github.sha }} .
    
    - name: Run security scan
      run: npm audit --audit-level moderate
  
  deploy:
    needs: [test, build]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/master'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to production
      run: |
        # Production deployment script
        echo "Deploying to production..."
```

## Operational Considerations

### Monitoring and Observability

```typescript
export class MetricsCollector {
  private metrics = new Map<string, Metric>();
  private prometheus: PrometheusRegistry;
  
  constructor() {
    this.prometheus = new PrometheusRegistry();
    this.initializeMetrics();
  }
  
  private initializeMetrics(): void {
    // Counter metrics
    this.metrics.set('tool_executions_total', new Counter({
      name: 'tool_executions_total',
      help: 'Total number of tool executions',
      labelNames: ['tool_name', 'status']
    }));
    
    this.metrics.set('content_generation_total', new Counter({
      name: 'content_generation_total',
      help: 'Total content generation requests',
      labelNames: ['content_type', 'status']
    }));
    
    // Histogram metrics
    this.metrics.set('tool_execution_duration', new Histogram({
      name: 'tool_execution_duration_seconds',
      help: 'Tool execution duration in seconds',
      labelNames: ['tool_name'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    }));
    
    this.metrics.set('content_generation_duration', new Histogram({
      name: 'content_generation_duration_seconds',
      help: 'Content generation duration in seconds',
      labelNames: ['content_type'],
      buckets: [1, 5, 10, 30, 60, 120, 300]
    }));
    
    // Gauge metrics
    this.metrics.set('active_connections', new Gauge({
      name: 'active_connections',
      help: 'Number of active connections'
    }));
    
    this.metrics.set('cache_hit_ratio', new Gauge({
      name: 'cache_hit_ratio',
      help: 'Cache hit ratio'
    }));
  }
  
  recordToolExecution(toolName: string, duration: number, status: 'success' | 'error'): void {
    this.metrics.get('tool_executions_total')!.inc({ tool_name: toolName, status });
    this.metrics.get('tool_execution_duration')!.observe({ tool_name: toolName }, duration);
  }
  
  recordContentGeneration(contentType: string, duration: number, status: 'success' | 'error'): void {
    this.metrics.get('content_generation_total')!.inc({ content_type: contentType, status });
    this.metrics.get('content_generation_duration')!.observe({ content_type: contentType }, duration);
  }
  
  updateActiveConnections(count: number): void {
    this.metrics.get('active_connections')!.set(count);
  }
  
  updateCacheHitRatio(ratio: number): void {
    this.metrics.get('cache_hit_ratio')!.set(ratio);
  }
  
  async getMetrics(): Promise<string> {
    return this.prometheus.metrics();
  }
}
```

### Health Checks

```typescript
export class HealthChecker {
  private checks = new Map<string, HealthCheck>();
  
  constructor(
    private claudeService: ClaudeService,
    private storageService: StorageService
  ) {
    this.registerChecks();
  }
  
  private registerChecks(): void {
    this.checks.set('claude_api', {
      name: 'Claude API',
      check: () => this.checkClaudeAPI(),
      timeout: 5000,
      critical: true
    });
    
    this.checks.set('storage', {
      name: 'Storage',
      check: () => this.checkStorage(),
      timeout: 2000,
      critical: true
    });
    
    this.checks.set('memory', {
      name: 'Memory Usage',
      check: () => this.checkMemoryUsage(),
      timeout: 1000,
      critical: false
    });
  }
  
  async checkHealth(): Promise<HealthStatus> {
    const results = new Map<string, CheckResult>();
    const startTime = Date.now();
    
    // Run all health checks
    await Promise.allSettled(
      Array.from(this.checks.entries()).map(async ([name, check]) => {
        try {
          const checkStartTime = Date.now();
          const result = await Promise.race([
            check.check(),
            this.timeout(check.timeout)
          ]);
          
          results.set(name, {
            name: check.name,
            status: 'healthy',
            duration: Date.now() - checkStartTime,
            details: result
          });
        } catch (error) {
          results.set(name, {
            name: check.name,
            status: check.critical ? 'critical' : 'unhealthy',
            duration: Date.now() - checkStartTime,
            error: error.message
          });
        }
      })
    );
    
    // Determine overall status
    const hasFailures = Array.from(results.values()).some(
      result => result.status === 'critical'
    );
    
    const hasWarnings = Array.from(results.values()).some(
      result => result.status === 'unhealthy'
    );
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (hasFailures) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      checks: Object.fromEntries(results)
    };
  }
  
  private async checkClaudeAPI(): Promise<any> {
    return this.claudeService.healthCheck();
  }
  
  private async checkStorage(): Promise<any> {
    await this.storageService.ensureInitialized();
    return { accessible: true };
  }
  
  private async checkMemoryUsage(): Promise<any> {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const heapUtilization = (usage.heapUsed / usage.heapTotal) * 100;
    
    return {
      heapUsedMB: Math.round(heapUsedMB),
      heapTotalMB: Math.round(heapTotalMB),
      heapUtilization: Math.round(heapUtilization),
      warning: heapUtilization > 85
    };
  }
  
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), ms);
    });
  }
}
```

### Logging Configuration

```typescript
export class Logger {
  private winston: WinstonLogger;
  
  constructor(config: LoggingConfig) {
    this.winston = winston.createLogger({
      level: config.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'marketing-post-generator',
        version: process.env.npm_package_version
      },
      transports: this.createTransports(config)
    });
  }
  
  private createTransports(config: LoggingConfig): winston.transport[] {
    const transports: winston.transport[] = [];
    
    // Console transport
    if (config.console.enabled) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
          })
        )
      }));
    }
    
    // File transport
    if (config.file.enabled) {
      transports.push(new winston.transports.File({
        filename: config.file.path,
        maxsize: config.file.maxSize,
        maxFiles: config.file.maxFiles,
        tailable: true
      }));
    }
    
    // Error file transport
    transports.push(new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }));
    
    return transports;
  }
  
  info(message: string, meta?: any): void {
    this.winston.info(message, meta);
  }
  
  warn(message: string, meta?: any): void {
    this.winston.warn(message, meta);
  }
  
  error(message: string, meta?: any): void {
    this.winston.error(message, meta);
  }
  
  debug(message: string, meta?: any): void {
    this.winston.debug(message, meta);
  }
}
```

---

## Conclusion

This architecture document provides a comprehensive blueprint for implementing the Marketing Post Generator MCP server. The design emphasizes:

1. **Modularity**: Clear separation of concerns with dependency injection
2. **Scalability**: Performance optimization and caching strategies
3. **Reliability**: Comprehensive error handling and resilience patterns
4. **Maintainability**: Clean architecture and testing strategies
5. **Observability**: Monitoring, logging, and health checking
6. **Security**: Input validation, rate limiting, and secure deployment

The architecture leverages modern TypeScript and Node.js patterns while adhering to MCP protocol specifications and Claude Code integration requirements. The design supports both local and remote deployment modes with containerization support for production environments.

Key design decisions prioritize developer experience, operational reliability, and system extensibility. The dependency injection architecture enables comprehensive testing, while the factory and strategy patterns provide flexibility for future enhancements.

This architecture serves as the foundation for a robust, production-ready MCP server that can scale to meet the demands of content generation workflows while maintaining high standards of code quality and operational excellence.