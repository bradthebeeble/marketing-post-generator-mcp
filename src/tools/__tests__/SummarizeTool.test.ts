import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SummarizeTool } from '../SummarizeTool.js';
import { MockClaudeService, MockSearchService } from '../../__tests__/utils/mocks.js';
import { setupPostgenMocks } from '../../__tests__/utils/testHelpers.js';

// Mock fs/promises
jest.mock('fs/promises');

describe('SummarizeTool', () => {
  let summarizeTool: SummarizeTool;
  let mockSearchService: MockSearchService;
  let mockClaudeService: MockClaudeService;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock services
    mockSearchService = new MockSearchService();
    mockClaudeService = new MockClaudeService();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Create tool instance
    summarizeTool = new SummarizeTool(mockSearchService, mockLogger);
    
    // Setup file system mocks
    setupPostgenMocks();
  });

  describe('Tool Definition', () => {
    it('should have correct tool definition', () => {
      const definition = summarizeTool.getToolDefinition();
      
      expect(definition.name).toBe('summarize');
      expect(definition.description).toContain('Generate a concise summary');
      expect(definition.inputSchema.type).toBe('object');
      expect(definition.inputSchema.properties).toHaveProperty('url');
      expect(definition.inputSchema.required).toContain('url');
    });

    it('should have optional format parameter', () => {
      const definition = summarizeTool.getToolDefinition();
      
      expect(definition.inputSchema.properties).toHaveProperty('format');
      expect(definition.inputSchema.properties.format).toHaveProperty('enum');
      expect(definition.inputSchema.properties.format.enum).toContain('paragraph');
      expect(definition.inputSchema.properties.format.enum).toContain('bullet-points');
    });
  });

  describe('Tool Execution', () => {
    it('should successfully summarize a blog post URL', async () => {
      const args = {
        url: 'https://example.com/blog-post',
        format: 'paragraph'
      };

      const result = await summarizeTool.execute(args, mockClaudeService);
      
      // Verify the result structure
      expect(result).toContain('Summary of');
      expect(result).toContain('https://example.com/blog-post');
      
      // Verify search service was called to get content
      expect(mockSearchService.getContent).toHaveBeenCalledWith('https://example.com/blog-post');
      
      // Verify Claude was called for summarization
      expect(mockClaudeService.generateContent).toHaveBeenCalled();
      
      // Check that the Claude prompt contains the expected content
      const claudeCall = mockClaudeService.generateContent as jest.MockedFunction<any>;
      const prompt = claudeCall.mock.calls[0][0];
      expect(prompt).toContain('summarize');
      expect(prompt).toContain('paragraph');
      
      // Verify logger was used
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle bullet-points format', async () => {
      const args = {
        url: 'https://example.com/blog-post',
        format: 'bullet-points'
      };

      const result = await summarizeTool.execute(args, mockClaudeService);
      
      expect(result).toContain('Summary of');
      
      // Check that the Claude prompt specifies bullet points format
      const claudeCall = mockClaudeService.generateContent as jest.MockedFunction<any>;
      const prompt = claudeCall.mock.calls[0][0];
      expect(prompt).toContain('bullet');
    });

    it('should default to paragraph format when format not specified', async () => {
      const args = {
        url: 'https://example.com/blog-post'
      };

      const result = await summarizeTool.execute(args, mockClaudeService);
      
      expect(result).toContain('Summary of');
      
      // Check that the Claude prompt uses default paragraph format
      const claudeCall = mockClaudeService.generateContent as jest.MockedFunction<any>;
      const prompt = claudeCall.mock.calls[0][0];
      expect(prompt).toContain('paragraph');
    });

    it('should throw error if .postgen directory does not exist', async () => {
      // Mock fs.access to simulate missing .postgen directory
      const fs = require('fs/promises');
      fs.access.mockRejectedValueOnce(new Error('Directory not found'));

      const args = {
        url: 'https://example.com/blog-post'
      };

      await expect(summarizeTool.execute(args, mockClaudeService))
        .rejects
        .toThrow('Please run the init prompt first');
    });

    it('should handle invalid URL format', async () => {
      const args = {
        url: 'not-a-valid-url'
      };

      await expect(summarizeTool.execute(args, mockClaudeService))
        .rejects
        .toThrow();
    });

    it('should handle search service errors gracefully', async () => {
      // Make search service throw an error
      jest.spyOn(mockSearchService, 'getContent').mockRejectedValueOnce(
        new Error('Failed to fetch content')
      );

      const args = {
        url: 'https://example.com/blog-post'
      };

      await expect(summarizeTool.execute(args, mockClaudeService))
        .rejects
        .toThrow('Failed to fetch content');
        
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should store summary results to file system', async () => {
      const fs = require('fs/promises');
      
      const args = {
        url: 'https://example.com/blog-post',
        format: 'paragraph'
      };

      await summarizeTool.execute(args, mockClaudeService);
      
      // Verify files were written
      expect(fs.writeFile).toHaveBeenCalled();
      
      // Check that the written content includes summary data
      const writeFileCalls = fs.writeFile.mock.calls;
      const summaryCall = writeFileCalls.find((call: any) => 
        call[0].includes('summaries') && call[0].includes('.json')
      );
      
      expect(summaryCall).toBeDefined();
      
      if (summaryCall) {
        const writtenData = JSON.parse(summaryCall[1]);
        expect(writtenData).toHaveProperty('url', 'https://example.com/blog-post');
        expect(writtenData).toHaveProperty('summary');
        expect(writtenData).toHaveProperty('format', 'paragraph');
        expect(writtenData).toHaveProperty('timestamp');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content from URL', async () => {
      // Mock empty content
      jest.spyOn(mockSearchService, 'getContent').mockResolvedValueOnce({
        url: 'https://example.com/empty-post',
        title: 'Empty Post',
        content: '',
        metadata: {}
      });

      const args = {
        url: 'https://example.com/empty-post'
      };

      await expect(summarizeTool.execute(args, mockClaudeService))
        .rejects
        .toThrow('No content found');
    });

    it('should handle Claude service errors', async () => {
      // Make Claude service throw an error
      jest.spyOn(mockClaudeService, 'generateContent').mockRejectedValueOnce(
        new Error('Claude API error')
      );

      const args = {
        url: 'https://example.com/blog-post'
      };

      await expect(summarizeTool.execute(args, mockClaudeService))
        .rejects
        .toThrow('Claude API error');
    });

    it('should validate required URL parameter', async () => {
      const argsWithoutUrl = {
        format: 'paragraph'
      } as any;

      await expect(summarizeTool.execute(argsWithoutUrl, mockClaudeService))
        .rejects
        .toThrow();
    });

    it('should handle very long content gracefully', async () => {
      // Mock very long content
      const longContent = 'A'.repeat(50000); // 50k characters
      jest.spyOn(mockSearchService, 'getContent').mockResolvedValueOnce({
        url: 'https://example.com/long-post',
        title: 'Very Long Post',
        content: longContent,
        metadata: {}
      });

      const args = {
        url: 'https://example.com/long-post'
      };

      const result = await summarizeTool.execute(args, mockClaudeService);
      
      expect(result).toContain('Summary of');
      
      // Verify that content was truncated or handled appropriately
      const claudeCall = mockClaudeService.generateContent as jest.MockedFunction<any>;
      const prompt = claudeCall.mock.calls[0][0];
      
      // The prompt should not be excessively long
      expect(prompt.length).toBeLessThan(100000);
    });

    it('should handle various URL formats', async () => {
      const urls = [
        'https://example.com/post',
        'http://example.com/post',
        'https://subdomain.example.com/post',
        'https://example.com/category/post',
        'https://example.com/post?param=value'
      ];

      for (const url of urls) {
        const args = { url };
        
        const result = await summarizeTool.execute(args, mockClaudeService);
        expect(result).toContain('Summary of');
        expect(result).toContain(url);
      }
    });
  });
});