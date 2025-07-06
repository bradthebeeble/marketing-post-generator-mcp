import { Tool, Prompt } from '@modelcontextprotocol/sdk/types.js';
import {
  ToolRegistryEntry,
  PromptRegistryEntry,
  ValidationResult,
  VersionInfo
} from './types.js';

/**
 * Validator for ensuring MCP specification compliance
 */
export class RegistryValidator {
  private readonly TOOL_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
  private readonly PROMPT_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
  private readonly MAX_NAME_LENGTH = 100;
  private readonly MAX_DESCRIPTION_LENGTH = 1000;
  private readonly REQUIRED_SCHEMA_PROPERTIES = ['type'];

  /**
   * Validate a tool registry entry for MCP compliance
   */
  validateTool(entry: ToolRegistryEntry): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic entry validation
    const baseValidation = this.validateBaseEntry(entry);
    errors.push(...baseValidation.errors);
    warnings.push(...baseValidation.warnings);

    // Tool-specific validation
    if (!entry.toolDefinition) {
      errors.push('Tool definition is required');
      return { isValid: false, errors, warnings };
    }

    // Validate tool definition structure
    const toolDefValidation = this.validateToolDefinition(entry.toolDefinition);
    errors.push(...toolDefValidation.errors);
    warnings.push(...toolDefValidation.warnings);

    // Validate handler function
    if (!entry.handler || typeof entry.handler !== 'function') {
      errors.push('Tool handler must be a function');
    }

    // Validate input validation function if provided
    if (entry.inputValidation && typeof entry.inputValidation !== 'function') {
      errors.push('Input validation must be a function');
    }

    // Validate dependencies if provided
    if (entry.dependencies) {
      const depValidation = this.validateDependencies(entry.dependencies);
      errors.push(...depValidation.errors);
      warnings.push(...depValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a prompt registry entry for MCP compliance
   */
  validatePrompt(entry: PromptRegistryEntry): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic entry validation
    const baseValidation = this.validateBaseEntry(entry);
    errors.push(...baseValidation.errors);
    warnings.push(...baseValidation.warnings);

    // Prompt-specific validation
    if (!entry.promptDefinition) {
      errors.push('Prompt definition is required');
      return { isValid: false, errors, warnings };
    }

    // Validate prompt definition structure
    const promptDefValidation = this.validatePromptDefinition(entry.promptDefinition);
    errors.push(...promptDefValidation.errors);
    warnings.push(...promptDefValidation.warnings);

    // Validate handler function
    if (!entry.handler || typeof entry.handler !== 'function') {
      errors.push('Prompt handler must be a function');
    }

    // Validate input validation function if provided
    if (entry.inputValidation && typeof entry.inputValidation !== 'function') {
      errors.push('Input validation must be a function');
    }

    // Validate dependencies if provided
    if (entry.dependencies) {
      const depValidation = this.validateDependencies(entry.dependencies);
      errors.push(...depValidation.errors);
      warnings.push(...depValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate MCP tool definition according to specification
   */
  validateToolDefinition(tool: Tool): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required properties
    if (!tool.name || typeof tool.name !== 'string') {
      errors.push('Tool name is required and must be a string');
    } else {
      // Validate name format
      if (!this.TOOL_NAME_PATTERN.test(tool.name)) {
        errors.push('Tool name must start with a letter and contain only letters, numbers, underscores, and hyphens');
      }
      
      if (tool.name.length > this.MAX_NAME_LENGTH) {
        errors.push(`Tool name must not exceed ${this.MAX_NAME_LENGTH} characters`);
      }
    }

    if (!tool.description || typeof tool.description !== 'string') {
      errors.push('Tool description is required and must be a string');
    } else if (tool.description.length > this.MAX_DESCRIPTION_LENGTH) {
      errors.push(`Tool description must not exceed ${this.MAX_DESCRIPTION_LENGTH} characters`);
    }

    // Validate input schema
    if (!tool.inputSchema) {
      errors.push('Tool input schema is required');
    } else {
      const schemaValidation = this.validateInputSchema(tool.inputSchema);
      errors.push(...schemaValidation.errors);
      warnings.push(...schemaValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate MCP prompt definition according to specification
   */
  validatePromptDefinition(prompt: Prompt): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required properties
    if (!prompt.name || typeof prompt.name !== 'string') {
      errors.push('Prompt name is required and must be a string');
    } else {
      // Validate name format
      if (!this.PROMPT_NAME_PATTERN.test(prompt.name)) {
        errors.push('Prompt name must start with a letter and contain only letters, numbers, underscores, and hyphens');
      }
      
      if (prompt.name.length > this.MAX_NAME_LENGTH) {
        errors.push(`Prompt name must not exceed ${this.MAX_NAME_LENGTH} characters`);
      }
    }

    if (!prompt.description || typeof prompt.description !== 'string') {
      errors.push('Prompt description is required and must be a string');
    } else if (prompt.description.length > this.MAX_DESCRIPTION_LENGTH) {
      errors.push(`Prompt description must not exceed ${this.MAX_DESCRIPTION_LENGTH} characters`);
    }

    // Validate parameters
    if (!prompt.parameters || !Array.isArray(prompt.parameters)) {
      errors.push('Prompt parameters must be an array');
    } else {
      prompt.parameters.forEach((param: any, index: number) => {
        const paramValidation = this.validatePromptParameter(param, index);
        errors.push(...paramValidation.errors);
        warnings.push(...paramValidation.warnings);
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate naming conventions for tools and prompts
   */
  validateNamingConvention(name: string, prefix?: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check prefix requirement
    if (prefix && !name.startsWith(prefix)) {
      errors.push(`Name '${name}' must start with prefix '${prefix}'`);
    }

    // Check for reserved names
    const reservedNames = ['init', 'health', 'status', 'version', 'help'];
    if (reservedNames.includes(name.toLowerCase())) {
      errors.push(`Name '${name}' is reserved and cannot be used`);
    }

    // Check for naming consistency
    if (name.includes('__')) {
      warnings.push(`Name '${name}' contains double underscores which may cause confusion`);
    }

    // Check length
    if (name.length < 3) {
      warnings.push(`Name '${name}' is very short and may not be descriptive enough`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate version information
   */
  validateVersion(version: VersionInfo): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check version components
    if (typeof version.major !== 'number' || version.major < 0) {
      errors.push('Major version must be a non-negative number');
    }

    if (typeof version.minor !== 'number' || version.minor < 0) {
      errors.push('Minor version must be a non-negative number');
    }

    if (typeof version.patch !== 'number' || version.patch < 0) {
      errors.push('Patch version must be a non-negative number');
    }

    // Check prerelease format if provided
    if (version.prerelease) {
      if (typeof version.prerelease !== 'string') {
        errors.push('Prerelease must be a string');
      } else if (!/^[a-zA-Z0-9.-]+$/.test(version.prerelease)) {
        errors.push('Prerelease must contain only letters, numbers, dots, and hyphens');
      }
    }

    // Version warnings
    if (version.major === 0) {
      warnings.push('Major version 0 indicates unstable API');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Private helper methods

  private validateBaseEntry(entry: ToolRegistryEntry | PromptRegistryEntry): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!entry.id || typeof entry.id !== 'string') {
      errors.push('Entry ID is required and must be a string');
    }

    if (!entry.name || typeof entry.name !== 'string') {
      errors.push('Entry name is required and must be a string');
    }

    if (!entry.description || typeof entry.description !== 'string') {
      errors.push('Entry description is required and must be a string');
    }

    // Validate version
    if (!entry.version) {
      errors.push('Entry version is required');
    } else {
      const versionValidation = this.validateVersion(entry.version);
      errors.push(...versionValidation.errors);
      warnings.push(...versionValidation.warnings);
    }

    // Validate optional fields
    if (entry.author && typeof entry.author !== 'string') {
      errors.push('Author must be a string if provided');
    }

    if (entry.tags && !Array.isArray(entry.tags)) {
      errors.push('Tags must be an array if provided');
    } else if (entry.tags) {
      entry.tags.forEach((tag, index) => {
        if (typeof tag !== 'string') {
          errors.push(`Tag at index ${index} must be a string`);
        }
      });
    }

    if (entry.deprecated && typeof entry.deprecated !== 'boolean') {
      errors.push('Deprecated must be a boolean if provided');
    }

    if (entry.deprecationReason && typeof entry.deprecationReason !== 'string') {
      errors.push('Deprecation reason must be a string if provided');
    }

    // Validate dates
    if (!(entry.createdAt instanceof Date)) {
      errors.push('Created date must be a Date object');
    }

    if (!(entry.updatedAt instanceof Date)) {
      errors.push('Updated date must be a Date object');
    } else if (entry.createdAt instanceof Date && entry.updatedAt < entry.createdAt) {
      errors.push('Updated date cannot be before created date');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateInputSchema(schema: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check schema structure
    if (typeof schema !== 'object' || schema === null) {
      errors.push('Input schema must be an object');
      return { isValid: false, errors, warnings };
    }

    // Validate required schema properties
    this.REQUIRED_SCHEMA_PROPERTIES.forEach(prop => {
      if (!(prop in schema)) {
        errors.push(`Input schema must have '${prop}' property`);
      }
    });

    // Validate schema type
    if (schema.type !== 'object') {
      warnings.push('Input schema type should typically be "object" for MCP tools');
    }

    // Validate properties if present
    if (schema.properties) {
      if (typeof schema.properties !== 'object') {
        errors.push('Schema properties must be an object');
      } else {
        Object.keys(schema.properties).forEach(propName => {
          const prop = schema.properties[propName];
          if (typeof prop !== 'object' || !prop.type) {
            warnings.push(`Property '${propName}' should have a type specified`);
          }
        });
      }
    }

    // Validate required array if present
    if (schema.required) {
      if (!Array.isArray(schema.required)) {
        errors.push('Schema required must be an array');
      } else {
        schema.required.forEach((field: any) => {
          if (typeof field !== 'string') {
            errors.push('Required field names must be strings');
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validatePromptParameter(param: any, index: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof param !== 'object' || param === null) {
      errors.push(`Parameter at index ${index} must be an object`);
      return { isValid: false, errors, warnings };
    }

    // Validate required parameter properties
    if (!param.name || typeof param.name !== 'string') {
      errors.push(`Parameter at index ${index} must have a name (string)`);
    }

    if (!param.description || typeof param.description !== 'string') {
      errors.push(`Parameter at index ${index} must have a description (string)`);
    }

    if (typeof param.required !== 'boolean') {
      errors.push(`Parameter at index ${index} must have a required property (boolean)`);
    }

    // Additional validations for parameter name
    if (param.name && !this.TOOL_NAME_PATTERN.test(param.name)) {
      errors.push(`Parameter name '${param.name}' at index ${index} contains invalid characters`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateDependencies(dependencies: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(dependencies)) {
      errors.push('Dependencies must be an array');
      return { isValid: false, errors, warnings };
    }

    dependencies.forEach((dep, index) => {
      if (typeof dep !== 'string') {
        errors.push(`Dependency at index ${index} must be a string`);
      } else if (!this.TOOL_NAME_PATTERN.test(dep)) {
        errors.push(`Dependency '${dep}' at index ${index} has invalid format`);
      }
    });

    // Check for circular dependencies (basic check)
    const uniqueDeps = new Set(dependencies);
    if (uniqueDeps.size !== dependencies.length) {
      warnings.push('Dependencies contain duplicates');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}