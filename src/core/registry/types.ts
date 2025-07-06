import { Tool, Prompt } from '@modelcontextprotocol/sdk/types.js';

/**
 * Version information for registry entries
 */
export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

/**
 * Base registry entry interface
 */
export interface BaseRegistryEntry {
  id: string;
  name: string;
  description: string;
  version: VersionInfo;
  author?: string;
  tags?: string[];
  deprecated?: boolean;
  deprecationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tool registry entry
 */
export interface ToolRegistryEntry extends BaseRegistryEntry {
  type: 'tool';
  toolDefinition: Tool;
  handler: (args: any) => Promise<any>;
  inputValidation?: (args: any) => boolean;
  dependencies?: string[];
}

/**
 * Prompt registry entry  
 */
export interface PromptRegistryEntry extends BaseRegistryEntry {
  type: 'prompt';
  promptDefinition: Prompt;
  handler: (args: any) => Promise<string>;
  inputValidation?: (args: any) => boolean;
  dependencies?: string[];
}

/**
 * Union type for all registry entries
 */
export type RegistryEntry = ToolRegistryEntry | PromptRegistryEntry;

/**
 * Registry validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Discovery metadata for client exploration
 */
export interface DiscoveryMetadata {
  totalTools: number;
  totalPrompts: number;
  categories: string[];
  latestVersion: string;
  serverCapabilities: string[];
}

/**
 * Tool/prompt discovery entry for client exploration
 */
export interface DiscoveryEntry {
  name: string;
  type: 'tool' | 'prompt';
  description: string;
  version: string;
  deprecated: boolean;
  inputSchema?: any;
  parameters?: any[];
  tags: string[];
}

/**
 * Registry configuration options
 */
export interface RegistryConfig {
  validateOnRegister: boolean;
  allowDuplicateNames: boolean;
  enforceVersioning: boolean;
  maxRetries: number;
  enableLogging: boolean;
  namePrefix?: string;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalEntries: number;
  toolsCount: number;
  promptsCount: number;
  deprecatedCount: number;
  averageVersion: string;
  oldestEntry: Date;
  newestEntry: Date;
}

/**
 * Version compatibility check result
 */
export interface CompatibilityResult {
  compatible: boolean;
  requiredVersion: VersionInfo;
  currentVersion: VersionInfo;
  migrationRequired: boolean;
  migrationPath?: string[];
}

/**
 * Tool/prompt execution context
 */
export interface ExecutionContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  startTime: Date;
}

/**
 * Registry events for monitoring and logging
 */
export type RegistryEvent = 
  | { type: 'tool_registered'; entry: ToolRegistryEntry }
  | { type: 'prompt_registered'; entry: PromptRegistryEntry }
  | { type: 'tool_executed'; name: string; context: ExecutionContext }
  | { type: 'prompt_executed'; name: string; context: ExecutionContext }
  | { type: 'validation_failed'; name: string; errors: string[] }
  | { type: 'migration_required'; from: VersionInfo; to: VersionInfo };

/**
 * Registry error types
 */
export class RegistryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'RegistryError';
  }
}

export class ValidationError extends RegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class VersionError extends RegistryError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VERSION_ERROR', details);
    this.name = 'VersionError';
  }
}

export class DuplicateEntryError extends RegistryError {
  constructor(name: string) {
    super(`Entry with name '${name}' already exists`, 'DUPLICATE_ENTRY', { name });
    this.name = 'DuplicateEntryError';
  }
}