import { Tool, Prompt } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import {
  ToolRegistryEntry,
  PromptRegistryEntry,
  RegistryEntry,
  RegistryConfig,
  RegistryStats,
  DiscoveryEntry,
  DiscoveryMetadata,
  ExecutionContext,
  RegistryEvent,
  ValidationResult,
  VersionInfo,
  RegistryError,
  DuplicateEntryError,
  ValidationError
} from './types.js';

/**
 * Central registry for managing MCP tools and prompts
 */
export class ToolAndPromptRegistry {
  private tools: Map<string, ToolRegistryEntry> = new Map();
  private prompts: Map<string, PromptRegistryEntry> = new Map();
  private config: RegistryConfig;
  private logger: winston.Logger;
  private eventListeners: ((event: RegistryEvent) => void)[] = [];

  constructor(
    config: Partial<RegistryConfig> = {},
    logger?: winston.Logger
  ) {
    this.config = {
      validateOnRegister: true,
      allowDuplicateNames: false,
      enforceVersioning: true,
      maxRetries: 3,
      enableLogging: true,
      namePrefix: 'marketing_post_generator_mcp__',
      ...config
    };

    this.logger = logger || winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  /**
   * Register a tool in the registry
   */
  async registerTool(
    toolDefinition: Tool,
    handler: (args: any) => Promise<any>,
    metadata: Partial<Omit<ToolRegistryEntry, 'type' | 'toolDefinition' | 'handler'>> = {}
  ): Promise<void> {
    const entry: ToolRegistryEntry = {
      type: 'tool',
      id: metadata.id || this.generateId(toolDefinition.name),
      name: toolDefinition.name,
      description: toolDefinition.description,
      version: metadata.version || { major: 1, minor: 0, patch: 0 },
      toolDefinition,
      handler,
      author: metadata.author,
      tags: metadata.tags || [],
      deprecated: metadata.deprecated || false,
      deprecationReason: metadata.deprecationReason,
      createdAt: metadata.createdAt || new Date(),
      updatedAt: metadata.updatedAt || new Date(),
      inputValidation: metadata.inputValidation,
      dependencies: metadata.dependencies
    };

    await this.registerEntry(entry);
    this.emitEvent({ type: 'tool_registered', entry });
  }

  /**
   * Register a prompt in the registry
   */
  async registerPrompt(
    promptDefinition: Prompt,
    handler: (args: any) => Promise<string>,
    metadata: Partial<Omit<PromptRegistryEntry, 'type' | 'promptDefinition' | 'handler'>> = {}
  ): Promise<void> {
    const entry: PromptRegistryEntry = {
      type: 'prompt',
      id: metadata.id || this.generateId(promptDefinition.name),
      name: promptDefinition.name,
      description: promptDefinition.description,
      version: metadata.version || { major: 1, minor: 0, patch: 0 },
      promptDefinition,
      handler,
      author: metadata.author,
      tags: metadata.tags || [],
      deprecated: metadata.deprecated || false,
      deprecationReason: metadata.deprecationReason,
      createdAt: metadata.createdAt || new Date(),
      updatedAt: metadata.updatedAt || new Date(),
      inputValidation: metadata.inputValidation,
      dependencies: metadata.dependencies
    };

    await this.registerEntry(entry);
    this.emitEvent({ type: 'prompt_registered', entry });
  }

  /**
   * Register multiple tools and prompts at once
   */
  async registerAll(
    tools: Array<{
      definition: Tool;
      handler: (args: any) => Promise<any>;
      metadata?: Partial<Omit<ToolRegistryEntry, 'type' | 'toolDefinition' | 'handler'>>;
    }>,
    prompts: Array<{
      definition: Prompt;
      handler: (args: any) => Promise<string>;
      metadata?: Partial<Omit<PromptRegistryEntry, 'type' | 'promptDefinition' | 'handler'>>;
    }>
  ): Promise<void> {
    // Register tools
    for (const tool of tools) {
      await this.registerTool(tool.definition, tool.handler, tool.metadata);
    }

    // Register prompts
    for (const prompt of prompts) {
      await this.registerPrompt(prompt.definition, prompt.handler, prompt.metadata);
    }

    this.log('info', `Registered ${tools.length} tools and ${prompts.length} prompts`);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): ToolRegistryEntry | undefined {
    return this.tools.get(name);
  }

  /**
   * Get a prompt by name
   */
  getPrompt(name: string): PromptRegistryEntry | undefined {
    return this.prompts.get(name);
  }

  /**
   * Get all tool definitions for MCP server registration
   */
  getToolDefinitions(): Tool[] {
    return Array.from(this.tools.values())
      .filter(entry => !entry.deprecated)
      .map(entry => entry.toolDefinition);
  }

  /**
   * Get all prompt definitions for MCP server registration
   */
  getPromptDefinitions(): Prompt[] {
    return Array.from(this.prompts.values())
      .filter(entry => !entry.deprecated)
      .map(entry => entry.promptDefinition);
  }

  /**
   * Execute a tool by name
   */
  async executeTool(name: string, args: any, context?: Partial<ExecutionContext>): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new RegistryError(`Tool '${name}' not found`, 'TOOL_NOT_FOUND');
    }

    if (tool.deprecated) {
      this.log('warn', `Executing deprecated tool '${name}': ${tool.deprecationReason || 'No reason provided'}`);
    }

    const executionContext: ExecutionContext = {
      requestId: context?.requestId || this.generateId('exec'),
      userId: context?.userId,
      sessionId: context?.sessionId,
      metadata: context?.metadata,
      startTime: new Date()
    };

    this.emitEvent({ type: 'tool_executed', name, context: executionContext });

    // Validate input if validation function exists
    if (tool.inputValidation && !tool.inputValidation(args)) {
      throw new ValidationError(`Invalid input for tool '${name}'`);
    }

    try {
      return await tool.handler(args);
    } catch (error) {
      this.log('error', `Tool execution failed for '${name}': ${error}`);
      throw error;
    }
  }

  /**
   * Execute a prompt by name
   */
  async executePrompt(name: string, args: any, context?: Partial<ExecutionContext>): Promise<string> {
    const prompt = this.getPrompt(name);
    if (!prompt) {
      throw new RegistryError(`Prompt '${name}' not found`, 'PROMPT_NOT_FOUND');
    }

    if (prompt.deprecated) {
      this.log('warn', `Executing deprecated prompt '${name}': ${prompt.deprecationReason || 'No reason provided'}`);
    }

    const executionContext: ExecutionContext = {
      requestId: context?.requestId || this.generateId('exec'),
      userId: context?.userId,
      sessionId: context?.sessionId,
      metadata: context?.metadata,
      startTime: new Date()
    };

    this.emitEvent({ type: 'prompt_executed', name, context: executionContext });

    // Validate input if validation function exists
    if (prompt.inputValidation && !prompt.inputValidation(args)) {
      throw new ValidationError(`Invalid input for prompt '${name}'`);
    }

    try {
      return await prompt.handler(args);
    } catch (error) {
      this.log('error', `Prompt execution failed for '${name}': ${error}`);
      throw error;
    }
  }

  /**
   * Get discovery metadata for client exploration
   */
  getDiscoveryMetadata(): DiscoveryMetadata {
    const allTags = new Set<string>();
    let latestVersion = { major: 0, minor: 0, patch: 0 };

    // Collect all tags and find latest version
    [...this.tools.values(), ...this.prompts.values()].forEach(entry => {
      entry.tags?.forEach(tag => allTags.add(tag));
      if (this.compareVersions(entry.version, latestVersion) > 0) {
        latestVersion = entry.version;
      }
    });

    return {
      totalTools: this.tools.size,
      totalPrompts: this.prompts.size,
      categories: Array.from(allTags),
      latestVersion: this.formatVersion(latestVersion),
      serverCapabilities: ['tools', 'prompts', 'versioning', 'discovery']
    };
  }

  /**
   * Get discovery entries for client exploration
   */
  getDiscoveryEntries(): DiscoveryEntry[] {
    const entries: DiscoveryEntry[] = [];

    // Add tools
    this.tools.forEach(tool => {
      entries.push({
        name: tool.name,
        type: 'tool',
        description: tool.description,
        version: this.formatVersion(tool.version),
        deprecated: tool.deprecated || false,
        inputSchema: tool.toolDefinition.inputSchema,
        tags: tool.tags || []
      });
    });

    // Add prompts
    this.prompts.forEach(prompt => {
      entries.push({
        name: prompt.name,
        type: 'prompt',
        description: prompt.description,
        version: this.formatVersion(prompt.version),
        deprecated: prompt.deprecated || false,
        parameters: prompt.promptDefinition.parameters,
        tags: prompt.tags || []
      });
    });

    return entries;
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const allEntries = [...this.tools.values(), ...this.prompts.values()];
    const deprecatedCount = allEntries.filter(entry => entry.deprecated).length;
    
    let oldestEntry = new Date();
    let newestEntry = new Date(0);
    let totalVersion = { major: 0, minor: 0, patch: 0 };

    allEntries.forEach(entry => {
      if (entry.createdAt < oldestEntry) oldestEntry = entry.createdAt;
      if (entry.createdAt > newestEntry) newestEntry = entry.createdAt;
      totalVersion.major += entry.version.major;
      totalVersion.minor += entry.version.minor;
      totalVersion.patch += entry.version.patch;
    });

    // Calculate average version
    const count = allEntries.length || 1;
    const averageVersion = {
      major: Math.round(totalVersion.major / count),
      minor: Math.round(totalVersion.minor / count),
      patch: Math.round(totalVersion.patch / count)
    };

    return {
      totalEntries: allEntries.length,
      toolsCount: this.tools.size,
      promptsCount: this.prompts.size,
      deprecatedCount,
      averageVersion: this.formatVersion(averageVersion),
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Add event listener for registry events
   */
  addEventListener(listener: (event: RegistryEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: RegistryEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Clear all registered tools and prompts
   */
  clear(): void {
    this.tools.clear();
    this.prompts.clear();
    this.log('info', 'Registry cleared');
  }

  // Private helper methods

  private async registerEntry(entry: RegistryEntry): Promise<void> {
    // Check for duplicates
    if (!this.config.allowDuplicateNames) {
      const existing = entry.type === 'tool' ? this.tools.get(entry.name) : this.prompts.get(entry.name);
      if (existing) {
        throw new DuplicateEntryError(entry.name);
      }
    }

    // Validate name prefix
    if (this.config.namePrefix && !entry.name.startsWith(this.config.namePrefix)) {
      throw new ValidationError(
        `Entry name '${entry.name}' must start with prefix '${this.config.namePrefix}'`
      );
    }

    // Validate entry
    if (this.config.validateOnRegister) {
      const validationResult = this.validateEntry(entry);
      if (!validationResult.isValid) {
        this.emitEvent({ type: 'validation_failed', name: entry.name, errors: validationResult.errors });
        throw new ValidationError(`Validation failed for '${entry.name}': ${validationResult.errors.join(', ')}`);
      }
    }

    // Register the entry
    if (entry.type === 'tool') {
      this.tools.set(entry.name, entry);
    } else {
      this.prompts.set(entry.name, entry);
    }

    this.log('info', `Registered ${entry.type} '${entry.name}' version ${this.formatVersion(entry.version)}`);
  }

  private validateEntry(entry: RegistryEntry): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!entry.name || entry.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!entry.description || entry.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (!entry.version) {
      errors.push('Version is required');
    }

    // Type-specific validation
    if (entry.type === 'tool') {
      if (!entry.toolDefinition) {
        errors.push('Tool definition is required');
      }
      if (!entry.handler) {
        errors.push('Tool handler is required');
      }
    } else if (entry.type === 'prompt') {
      if (!entry.promptDefinition) {
        errors.push('Prompt definition is required');
      }
      if (!entry.handler) {
        errors.push('Prompt handler is required');
      }
    }

    // Check for deprecated entries without reason
    if (entry.deprecated && !entry.deprecationReason) {
      warnings.push('Deprecated entry should have a deprecation reason');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private generateId(name: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${name}_${timestamp}_${random}`;
  }

  private compareVersions(v1: VersionInfo, v2: VersionInfo): number {
    if (v1.major !== v2.major) return v1.major - v2.major;
    if (v1.minor !== v2.minor) return v1.minor - v2.minor;
    return v1.patch - v2.patch;
  }

  private formatVersion(version: VersionInfo): string {
    let versionString = `${version.major}.${version.minor}.${version.patch}`;
    if (version.prerelease) {
      versionString += `-${version.prerelease}`;
    }
    return versionString;
  }

  private emitEvent(event: RegistryEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        this.log('error', `Event listener error: ${error}`);
      }
    });
  }

  private log(level: string, message: string): void {
    if (this.config.enableLogging) {
      this.logger.log(level, `[ToolAndPromptRegistry] ${message}`);
    }
  }
}