import { describe, it, expect, beforeEach } from '@jest/globals';
import { RegistryValidator } from '../RegistryValidator.js';
import { ToolRegistryEntry, PromptRegistryEntry, VersionInfo } from '../types.js';
import { Tool, MCPPrompt } from '@modelcontextprotocol/sdk/types.js';

describe('RegistryValidator', () => {
  let validator: RegistryValidator;

  beforeEach(() => {
    validator = new RegistryValidator();
  });

  describe('Tool Definition Validation', () => {
    it('should validate a correct tool definition', () => {
      const tool: Tool = {
        name: 'valid_tool',
        description: 'A valid tool description',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input parameter' }
          },
          required: ['input']
        }
      };

      const result = validator.validateToolDefinition(tool);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject tool with missing name', () => {
      const tool = {
        description: 'A tool without name',
        inputSchema: { type: 'object', properties: {} }
      } as Tool;

      const result = validator.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('name is required'));
    });

    it('should reject tool with invalid name format', () => {
      const tool: Tool = {
        name: '123invalid',
        description: 'Tool with invalid name',
        inputSchema: { type: 'object', properties: {} }
      };

      const result = validator.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('start with a letter'));
    });

    it('should reject tool with name too long', () => {
      const tool: Tool = {
        name: 'a'.repeat(101), // Exceeds MAX_NAME_LENGTH
        description: 'Tool with very long name',
        inputSchema: { type: 'object', properties: {} }
      };

      const result = validator.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must not exceed'));
    });

    it('should reject tool with missing description', () => {
      const tool = {
        name: 'valid_tool',
        inputSchema: { type: 'object', properties: {} }
      } as Tool;

      const result = validator.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('description is required'));
    });

    it('should reject tool with description too long', () => {
      const tool: Tool = {
        name: 'valid_tool',
        description: 'A'.repeat(1001), // Exceeds MAX_DESCRIPTION_LENGTH
        inputSchema: { type: 'object', properties: {} }
      };

      const result = validator.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must not exceed'));
    });

    it('should reject tool with missing input schema', () => {
      const tool = {
        name: 'valid_tool',
        description: 'A valid tool description'
      } as Tool;

      const result = validator.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('input schema is required'));
    });

    it('should validate input schema structure', () => {
      const tool: Tool = {
        name: 'valid_tool',
        description: 'A valid tool description',
        inputSchema: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'First parameter' },
            param2: { type: 'number', description: 'Second parameter' }
          },
          required: ['param1']
        }
      };

      const result = validator.validateToolDefinition(tool);
      expect(result.isValid).toBe(true);
    });

    it('should handle invalid input schema', () => {
      const tool: Tool = {
        name: 'valid_tool',
        description: 'A valid tool description',
        inputSchema: null as any
      };

      const result = validator.validateToolDefinition(tool);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must be an object'));
    });
  });

  describe('Prompt Definition Validation', () => {
    it('should validate a correct prompt definition', () => {
      const prompt: MCPPrompt = {
        name: 'valid_prompt',
        description: 'A valid prompt description',
        parameters: [
          {
            name: 'input',
            description: 'Input parameter',
            required: true
          }
        ]
      };

      const result = validator.validatePromptDefinition(prompt);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject prompt with missing name', () => {
      const prompt = {
        description: 'A prompt without name',
        parameters: []
      } as MCPPrompt;

      const result = validator.validatePromptDefinition(prompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('name is required'));
    });

    it('should reject prompt with invalid name format', () => {
      const prompt: MCPPrompt = {
        name: '123invalid',
        description: 'Prompt with invalid name',
        parameters: []
      };

      const result = validator.validatePromptDefinition(prompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('start with a letter'));
    });

    it('should reject prompt with missing parameters', () => {
      const prompt = {
        name: 'valid_prompt',
        description: 'A valid prompt description'
      } as MCPPrompt;

      const result = validator.validatePromptDefinition(prompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must be an array'));
    });

    it('should validate prompt parameters', () => {
      const prompt: MCPPrompt = {
        name: 'valid_prompt',
        description: 'A valid prompt description',
        parameters: [
          {
            name: 'param1',
            description: 'First parameter',
            required: true
          },
          {
            name: 'param2',
            description: 'Second parameter',
            required: false
          }
        ]
      };

      const result = validator.validatePromptDefinition(prompt);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid prompt parameters', () => {
      const prompt: MCPPrompt = {
        name: 'valid_prompt',
        description: 'A valid prompt description',
        parameters: [
          {
            name: '', // Invalid name
            description: 'Parameter with empty name',
            required: true
          }
        ]
      };

      const result = validator.validatePromptDefinition(prompt);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must have a name'));
    });
  });

  describe('Tool Registry Entry Validation', () => {
    it('should validate a complete tool registry entry', () => {
      const entry: ToolRegistryEntry = {
        type: 'tool',
        id: 'test-tool-id',
        name: 'test_tool',
        description: 'A test tool',
        version: { major: 1, minor: 0, patch: 0 },
        toolDefinition: {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} }
        },
        handler: async () => 'result',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = validator.validateTool(entry);
      expect(result.isValid).toBe(true);
    });

    it('should reject tool entry with missing handler', () => {
      const entry = {
        type: 'tool',
        id: 'test-tool-id',
        name: 'test_tool',
        description: 'A test tool',
        version: { major: 1, minor: 0, patch: 0 },
        toolDefinition: {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      } as ToolRegistryEntry;

      const result = validator.validateTool(entry);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('handler must be a function'));
    });

    it('should validate tool entry with dependencies', () => {
      const entry: ToolRegistryEntry = {
        type: 'tool',
        id: 'test-tool-id',
        name: 'test_tool',
        description: 'A test tool',
        version: { major: 1, minor: 0, patch: 0 },
        toolDefinition: {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} }
        },
        handler: async () => 'result',
        dependencies: ['dependency1', 'dependency2'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = validator.validateTool(entry);
      expect(result.isValid).toBe(true);
    });

    it('should reject tool entry with invalid dependencies', () => {
      const entry: ToolRegistryEntry = {
        type: 'tool',
        id: 'test-tool-id',
        name: 'test_tool',
        description: 'A test tool',
        version: { major: 1, minor: 0, patch: 0 },
        toolDefinition: {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: {} }
        },
        handler: async () => 'result',
        dependencies: ['123invalid'], // Invalid dependency name
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = validator.validateTool(entry);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('invalid format'));
    });
  });

  describe('Prompt Registry Entry Validation', () => {
    it('should validate a complete prompt registry entry', () => {
      const entry: PromptRegistryEntry = {
        type: 'prompt',
        id: 'test-prompt-id',
        name: 'test_prompt',
        description: 'A test prompt',
        version: { major: 1, minor: 0, patch: 0 },
        promptDefinition: {
          name: 'test_prompt',
          description: 'A test prompt',
          parameters: []
        },
        handler: async () => 'result',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = validator.validatePrompt(entry);
      expect(result.isValid).toBe(true);
    });

    it('should reject prompt entry with missing handler', () => {
      const entry = {
        type: 'prompt',
        id: 'test-prompt-id',
        name: 'test_prompt',
        description: 'A test prompt',
        version: { major: 1, minor: 0, patch: 0 },
        promptDefinition: {
          name: 'test_prompt',
          description: 'A test prompt',
          parameters: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      } as PromptRegistryEntry;

      const result = validator.validatePrompt(entry);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('handler must be a function'));
    });
  });

  describe('Naming Convention Validation', () => {
    it('should validate correct naming convention', () => {
      const result = validator.validateNamingConvention(
        'marketing_post_generator_mcp__test_tool',
        'marketing_post_generator_mcp__'
      );
      expect(result.isValid).toBe(true);
    });

    it('should reject name without required prefix', () => {
      const result = validator.validateNamingConvention(
        'test_tool',
        'marketing_post_generator_mcp__'
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must start with prefix'));
    });

    it('should reject reserved names', () => {
      const result = validator.validateNamingConvention('init');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('reserved'));
    });

    it('should warn about double underscores', () => {
      const result = validator.validateNamingConvention('test__tool');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(expect.stringContaining('double underscores'));
    });

    it('should warn about very short names', () => {
      const result = validator.validateNamingConvention('ab');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(expect.stringContaining('very short'));
    });
  });

  describe('Version Validation', () => {
    it('should validate correct version info', () => {
      const version: VersionInfo = { major: 1, minor: 2, patch: 3 };
      const result = validator.validateVersion(version);
      expect(result.isValid).toBe(true);
    });

    it('should validate version with prerelease', () => {
      const version: VersionInfo = { 
        major: 1, 
        minor: 2, 
        patch: 3, 
        prerelease: 'alpha.1' 
      };
      const result = validator.validateVersion(version);
      expect(result.isValid).toBe(true);
    });

    it('should reject negative version numbers', () => {
      const version: VersionInfo = { major: -1, minor: 0, patch: 0 };
      const result = validator.validateVersion(version);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('non-negative'));
    });

    it('should reject invalid prerelease format', () => {
      const version: VersionInfo = { 
        major: 1, 
        minor: 0, 
        patch: 0, 
        prerelease: 'invalid@prerelease' 
      };
      const result = validator.validateVersion(version);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('letters, numbers, dots, and hyphens'));
    });

    it('should warn about major version 0', () => {
      const version: VersionInfo = { major: 0, minor: 1, patch: 0 };
      const result = validator.validateVersion(version);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(expect.stringContaining('unstable API'));
    });
  });

  describe('Input Schema Validation', () => {
    it('should validate correct input schema', () => {
      const schema = {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'Parameter 1' },
          param2: { type: 'number', description: 'Parameter 2' }
        },
        required: ['param1']
      };

      const result = validator['validateInputSchema'](schema);
      expect(result.isValid).toBe(true);
    });

    it('should reject non-object schema', () => {
      const result = validator['validateInputSchema']('invalid');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must be an object'));
    });

    it('should require type property', () => {
      const schema = {
        properties: {
          param1: { type: 'string' }
        }
      };

      const result = validator['validateInputSchema'](schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must have \'type\' property'));
    });

    it('should warn about non-object type', () => {
      const schema = {
        type: 'string'
      };

      const result = validator['validateInputSchema'](schema);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(expect.stringContaining('should typically be "object"'));
    });

    it('should validate properties structure', () => {
      const schema = {
        type: 'object',
        properties: {
          validParam: { type: 'string', description: 'Valid parameter' },
          invalidParam: 'invalid' // Should be an object
        }
      };

      const result = validator['validateInputSchema'](schema);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(expect.stringContaining('should have a type'));
    });

    it('should validate required array', () => {
      const schema = {
        type: 'object',
        properties: {
          param1: { type: 'string' }
        },
        required: 'invalid' // Should be an array
      };

      const result = validator['validateInputSchema'](schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('must be an array'));
    });
  });
});