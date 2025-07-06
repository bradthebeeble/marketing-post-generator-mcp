import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import winston from 'winston';
import { ToolAndPromptRegistry } from '../ToolAndPromptRegistry.js';
import { RegistryConfig, VersionInfo, RegistryError, ValidationError } from '../types.js';
import { Tool, MCPPrompt } from '@modelcontextprotocol/sdk/types.js';

describe('ToolAndPromptRegistry', () => {
  let registry: ToolAndPromptRegistry;
  let mockLogger: winston.Logger;
  let config: RegistryConfig;

  // Mock tool and prompt definitions
  const mockTool: Tool = {
    name: 'marketing_post_generator_mcp__test_tool',
    description: 'A test tool',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Test input' }
      },
      required: ['input']
    }
  };

  const mockPrompt: MCPPrompt = {
    name: 'marketing_post_generator_mcp__test_prompt',
    description: 'A test prompt',
    parameters: [
      {
        name: 'input',
        description: 'Test input parameter',
        required: true
      }
    ]
  };

  const mockToolHandler = jest.fn().mockResolvedValue('tool result');
  const mockPromptHandler = jest.fn().mockResolvedValue('prompt result');

  beforeEach(() => {
    mockLogger = winston.createLogger({
      level: 'error',
      transports: [new winston.transports.Console({ silent: true })]
    });

    config = {
      validateOnRegister: true,
      allowDuplicateNames: false,
      enforceVersioning: true,
      maxRetries: 3,
      enableLogging: false,
      namePrefix: 'marketing_post_generator_mcp__'
    };

    registry = new ToolAndPromptRegistry(config, mockLogger);

    // Clear mock calls
    mockToolHandler.mockClear();
    mockPromptHandler.mockClear();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Tool Registration', () => {
    it('should register a tool successfully', async () => {
      await registry.registerTool(mockTool, mockToolHandler);

      const registeredTool = registry.getTool(mockTool.name);
      expect(registeredTool).toBeDefined();
      expect(registeredTool?.name).toBe(mockTool.name);
      expect(registeredTool?.description).toBe(mockTool.description);
    });

    it('should register a tool with custom metadata', async () => {
      const version: VersionInfo = { major: 2, minor: 1, patch: 0 };
      const author = 'Test Author';
      const tags = ['test', 'mock'];

      await registry.registerTool(mockTool, mockToolHandler, {
        version,
        author,
        tags
      });

      const registeredTool = registry.getTool(mockTool.name);
      expect(registeredTool?.version).toEqual(version);
      expect(registeredTool?.author).toBe(author);
      expect(registeredTool?.tags).toEqual(tags);
    });

    it('should prevent duplicate tool registration when not allowed', async () => {
      await registry.registerTool(mockTool, mockToolHandler);

      await expect(
        registry.registerTool(mockTool, mockToolHandler)
      ).rejects.toThrow('already exists');
    });

    it('should allow duplicate tool registration when configured', async () => {
      const registryWithDuplicates = new ToolAndPromptRegistry({
        ...config,
        allowDuplicateNames: true
      }, mockLogger);

      await registryWithDuplicates.registerTool(mockTool, mockToolHandler);
      await expect(
        registryWithDuplicates.registerTool(mockTool, mockToolHandler)
      ).resolves.not.toThrow();

      registryWithDuplicates.clear();
    });

    it('should validate tool name prefix', async () => {
      const invalidTool: Tool = {
        ...mockTool,
        name: 'invalid_tool_name'
      };

      await expect(
        registry.registerTool(invalidTool, mockToolHandler)
      ).rejects.toThrow('must start with prefix');
    });

    it('should skip validation when disabled', async () => {
      const registryNoValidation = new ToolAndPromptRegistry({
        ...config,
        validateOnRegister: false
      }, mockLogger);

      const invalidTool: Tool = {
        ...mockTool,
        name: 'invalid_tool_name'
      };

      await expect(
        registryNoValidation.registerTool(invalidTool, mockToolHandler)
      ).resolves.not.toThrow();

      registryNoValidation.clear();
    });
  });

  describe('Prompt Registration', () => {
    it('should register a prompt successfully', async () => {
      await registry.registerPrompt(mockPrompt, mockPromptHandler);

      const registeredPrompt = registry.getPrompt(mockPrompt.name);
      expect(registeredPrompt).toBeDefined();
      expect(registeredPrompt?.name).toBe(mockPrompt.name);
      expect(registeredPrompt?.description).toBe(mockPrompt.description);
    });

    it('should register a prompt with custom metadata', async () => {
      const version: VersionInfo = { major: 1, minor: 2, patch: 3 };
      const author = 'Prompt Author';
      const tags = ['prompt', 'test'];

      await registry.registerPrompt(mockPrompt, mockPromptHandler, {
        version,
        author,
        tags
      });

      const registeredPrompt = registry.getPrompt(mockPrompt.name);
      expect(registeredPrompt?.version).toEqual(version);
      expect(registeredPrompt?.author).toBe(author);
      expect(registeredPrompt?.tags).toEqual(tags);
    });

    it('should prevent duplicate prompt registration', async () => {
      await registry.registerPrompt(mockPrompt, mockPromptHandler);

      await expect(
        registry.registerPrompt(mockPrompt, mockPromptHandler)
      ).rejects.toThrow('already exists');
    });
  });

  describe('Tool Execution', () => {
    beforeEach(async () => {
      await registry.registerTool(mockTool, mockToolHandler);
    });

    it('should execute a tool successfully', async () => {
      const args = { input: 'test input' };
      const result = await registry.executeTool(mockTool.name, args);

      expect(result).toBe('tool result');
      expect(mockToolHandler).toHaveBeenCalledWith(args);
    });

    it('should throw error for non-existent tool', async () => {
      await expect(
        registry.executeTool('non_existent_tool', {})
      ).rejects.toThrow('not found');
    });

    it('should handle execution context', async () => {
      const context = {
        requestId: 'test-request',
        userId: 'test-user',
        metadata: { test: true }
      };

      const result = await registry.executeTool(mockTool.name, { input: 'test' }, context);
      expect(result).toBe('tool result');
    });

    it('should validate input when validation function exists', async () => {
      const validationFn = jest.fn().mockReturnValue(false);
      
      await registry.registerTool(mockTool, mockToolHandler, {
        inputValidation: validationFn
      });

      await expect(
        registry.executeTool(mockTool.name, { input: 'test' })
      ).rejects.toThrow(ValidationError);

      expect(validationFn).toHaveBeenCalledWith({ input: 'test' });
    });
  });

  describe('Prompt Execution', () => {
    beforeEach(async () => {
      await registry.registerPrompt(mockPrompt, mockPromptHandler);
    });

    it('should execute a prompt successfully', async () => {
      const args = { input: 'test input' };
      const result = await registry.executePrompt(mockPrompt.name, args);

      expect(result).toBe('prompt result');
      expect(mockPromptHandler).toHaveBeenCalledWith(args);
    });

    it('should throw error for non-existent prompt', async () => {
      await expect(
        registry.executePrompt('non_existent_prompt', {})
      ).rejects.toThrow('not found');
    });
  });

  describe('Bulk Registration', () => {
    it('should register multiple tools and prompts', async () => {
      const tools = [
        {
          definition: mockTool,
          handler: mockToolHandler,
          metadata: { version: { major: 1, minor: 0, patch: 0 } }
        }
      ];

      const prompts = [
        {
          definition: mockPrompt,
          handler: mockPromptHandler,
          metadata: { version: { major: 1, minor: 0, patch: 0 } }
        }
      ];

      await registry.registerAll(tools, prompts);

      expect(registry.getTool(mockTool.name)).toBeDefined();
      expect(registry.getPrompt(mockPrompt.name)).toBeDefined();
    });
  });

  describe('Discovery Methods', () => {
    beforeEach(async () => {
      await registry.registerTool(mockTool, mockToolHandler, {
        tags: ['test', 'tool']
      });
      await registry.registerPrompt(mockPrompt, mockPromptHandler, {
        tags: ['test', 'prompt']
      });
    });

    it('should get tool definitions', () => {
      const definitions = registry.getToolDefinitions();
      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe(mockTool.name);
    });

    it('should get prompt definitions', () => {
      const definitions = registry.getPromptDefinitions();
      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe(mockPrompt.name);
    });

    it('should get discovery metadata', () => {
      const metadata = registry.getDiscoveryMetadata();
      expect(metadata.totalTools).toBe(1);
      expect(metadata.totalPrompts).toBe(1);
      expect(metadata.categories).toContain('test');
      expect(metadata.serverCapabilities).toContain('tools');
      expect(metadata.serverCapabilities).toContain('prompts');
    });

    it('should get discovery entries', () => {
      const entries = registry.getDiscoveryEntries();
      expect(entries).toHaveLength(2);
      expect(entries.some(e => e.name === mockTool.name && e.type === 'tool')).toBe(true);
      expect(entries.some(e => e.name === mockPrompt.name && e.type === 'prompt')).toBe(true);
    });

    it('should get registry stats', () => {
      const stats = registry.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.toolsCount).toBe(1);
      expect(stats.promptsCount).toBe(1);
      expect(stats.deprecatedCount).toBe(0);
    });

    it('should exclude deprecated entries from definitions', async () => {
      await registry.registerTool(
        { ...mockTool, name: 'marketing_post_generator_mcp__deprecated_tool' },
        mockToolHandler,
        { deprecated: true }
      );

      const definitions = registry.getToolDefinitions();
      expect(definitions).toHaveLength(1); // Only non-deprecated
      expect(definitions[0].name).toBe(mockTool.name);
    });
  });

  describe('Event System', () => {
    it('should emit events for tool registration', async () => {
      const eventListener = jest.fn();
      registry.addEventListener(eventListener);

      await registry.registerTool(mockTool, mockToolHandler);

      expect(eventListener).toHaveBeenCalledWith({
        type: 'tool_registered',
        entry: expect.objectContaining({
          name: mockTool.name,
          type: 'tool'
        })
      });
    });

    it('should emit events for prompt registration', async () => {
      const eventListener = jest.fn();
      registry.addEventListener(eventListener);

      await registry.registerPrompt(mockPrompt, mockPromptHandler);

      expect(eventListener).toHaveBeenCalledWith({
        type: 'prompt_registered',
        entry: expect.objectContaining({
          name: mockPrompt.name,
          type: 'prompt'
        })
      });
    });

    it('should emit events for tool execution', async () => {
      const eventListener = jest.fn();
      registry.addEventListener(eventListener);

      await registry.registerTool(mockTool, mockToolHandler);
      await registry.executeTool(mockTool.name, { input: 'test' });

      expect(eventListener).toHaveBeenCalledWith({
        type: 'tool_executed',
        name: mockTool.name,
        context: expect.objectContaining({
          requestId: expect.any(String),
          startTime: expect.any(Date)
        })
      });
    });

    it('should remove event listeners', () => {
      const eventListener = jest.fn();
      registry.addEventListener(eventListener);
      registry.removeEventListener(eventListener);

      // Listener should not be called after removal
      registry.registerTool(mockTool, mockToolHandler);
      expect(eventListener).not.toHaveBeenCalled();
    });
  });

  describe('Registry Management', () => {
    it('should clear all entries', async () => {
      await registry.registerTool(mockTool, mockToolHandler);
      await registry.registerPrompt(mockPrompt, mockPromptHandler);

      registry.clear();

      expect(registry.getTool(mockTool.name)).toBeUndefined();
      expect(registry.getPrompt(mockPrompt.name)).toBeUndefined();
      expect(registry.getStats().totalEntries).toBe(0);
    });

    it('should handle deprecated entries warning', async () => {
      // Use a logger that captures warnings
      const logs: string[] = [];
      const testLogger = winston.createLogger({
        level: 'warn',
        transports: [
          new winston.transports.Stream({
            stream: {
              write: (message: string) => logs.push(message)
            }
          })
        ]
      });

      const testRegistry = new ToolAndPromptRegistry(config, testLogger);

      await testRegistry.registerTool(mockTool, mockToolHandler, {
        deprecated: true,
        deprecationReason: 'Test deprecation'
      });

      await testRegistry.executeTool(mockTool.name, { input: 'test' });

      // Should have warned about deprecated tool
      expect(logs.some(log => log.includes('deprecated'))).toBe(true);

      testRegistry.clear();
    });
  });
});