import { jest } from '@jest/globals';
import path from 'path';
import { MockClaudeService, MockSearchService } from './mocks.js';
import { DIContainer } from '../../core/container/DIContainer.js';
import type { ServerConfig } from '../../types/index.js';

/**
 * Creates a test configuration object with sensible defaults
 */
export const createTestConfig = (overrides: Partial<ServerConfig> = {}): ServerConfig => ({
  server: {
    mode: 'local',
    transport: 'stdio',
    port: 3000,
    host: '0.0.0.0',
    ...overrides.server
  },
  claude: {
    apiKey: 'test-claude-api-key',
    model: 'claude-3-sonnet-20240229',
    maxTokens: 1000,
    ...overrides.claude
  },
  search: {
    provider: 'firecrawl',
    firecrawl: {
      apiKey: 'test-firecrawl-api-key',
      baseUrl: 'https://api.firecrawl.dev'
    },
    ...overrides.search
  },
  logging: {
    level: 'error', // Reduce log noise in tests
    format: 'json',
    ...overrides.logging
  },
  cors: {
    allowedOrigins: ['*'],
    allowedHeaders: ['*'],
    credentials: false,
    ...overrides.cors
  },
  ...overrides
});

/**
 * Creates a test DI container with mock services
 */
export const createTestContainer = (): DIContainer => {
  const container = new DIContainer();
  
  // Register mock services
  container.register('ClaudeService', () => new MockClaudeService());
  container.register('SearchService', () => new MockSearchService());
  container.register('Logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }));
  container.register('Config', () => createTestConfig());
  
  return container;
};

/**
 * Creates a test file path within the project
 */
export const createTestPath = (...segments: string[]): string => {
  return path.join(process.cwd(), 'test-fixtures', ...segments);
};

/**
 * Creates a mock .postgen directory structure
 */
export const mockPostgenStructure = {
  config: {
    'config.json': JSON.stringify({
      domain: 'example.com',
      initialized: '2023-01-01T00:00:00.000Z'
    })
  },
  analysis: {
    'sample-analysis': {
      'sample-analysis.json': JSON.stringify({
        domain: 'example.com',
        posts: [
          { title: 'Sample Post 1', url: 'https://example.com/post1' },
          { title: 'Sample Post 2', url: 'https://example.com/post2' }
        ],
        analysis: { tone: 'professional', topics: ['tech', 'business'] }
      })
    },
    'tone-analysis': {
      'tone-analysis.json': JSON.stringify({
        domain: 'example.com',
        tone: 'professional',
        characteristics: ['clear', 'concise'],
        confidence: 0.9
      })
    }
  },
  'content-plans': {
    'content-plan-2023-01.json': JSON.stringify({
      timeframe: 'month',
      posts: [
        { id: '1', title: 'Test Post 1', topic: 'Testing' },
        { id: '2', title: 'Test Post 2', topic: 'Development' }
      ]
    })
  },
  narratives: {
    'narrative-1.json': JSON.stringify({
      postId: '1',
      narrative: 'Test narrative content',
      bulletPoints: ['Point 1', 'Point 2']
    })
  },
  posts: {
    'post-1.md': '# Test Post\n\nThis is a test post.',
    'post-1.json': JSON.stringify({
      id: '1',
      title: 'Test Post',
      created: '2023-01-01T00:00:00.000Z'
    })
  }
};

/**
 * Sets up file system mocks based on the postgen structure
 */
export const setupPostgenMocks = () => {
  const fs = require('fs/promises');
  
  // Override readFile to return data from our mock structure
  fs.readFile.mockImplementation((filePath: string) => {
    const relativePath = filePath.replace(process.cwd(), '').replace(/^\//, '');
    
    if (relativePath.includes('.postgen/config/config.json')) {
      return Promise.resolve(mockPostgenStructure.config['config.json']);
    }
    
    if (relativePath.includes('sample-analysis.json')) {
      return Promise.resolve(mockPostgenStructure.analysis['sample-analysis']['sample-analysis.json']);
    }
    
    if (relativePath.includes('tone-analysis.json')) {
      return Promise.resolve(mockPostgenStructure.analysis['tone-analysis']['tone-analysis.json']);
    }
    
    if (relativePath.includes('content-plan-')) {
      return Promise.resolve(mockPostgenStructure['content-plans']['content-plan-2023-01.json']);
    }
    
    if (relativePath.includes('narrative-')) {
      return Promise.resolve(mockPostgenStructure.narratives['narrative-1.json']);
    }
    
    if (relativePath.includes('post-') && relativePath.endsWith('.md')) {
      return Promise.resolve(mockPostgenStructure.posts['post-1.md']);
    }
    
    if (relativePath.includes('post-') && relativePath.endsWith('.json')) {
      return Promise.resolve(mockPostgenStructure.posts['post-1.json']);
    }
    
    return Promise.reject(new Error(`Mock file not found: ${filePath}`));
  });
  
  // Override access to simulate file/directory existence
  fs.access.mockImplementation((filePath: string) => {
    if (filePath.includes('.postgen')) {
      return Promise.resolve(); // .postgen directory exists
    }
    return Promise.reject(new Error(`Mock path not found: ${filePath}`));
  });
};

/**
 * Waits for a specified number of milliseconds
 */
export const wait = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Captures console output during test execution
 */
export const captureConsole = () => {
  const originalConsole = { ...console };
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];
  
  console.log = jest.fn((...args) => logs.push(args.join(' ')));
  console.error = jest.fn((...args) => errors.push(args.join(' ')));
  console.warn = jest.fn((...args) => warns.push(args.join(' ')));
  
  return {
    logs,
    errors,
    warns,
    restore: () => {
      Object.assign(console, originalConsole);
    }
  };
};

/**
 * Creates a test that times out after a specified duration
 */
export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Test timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

/**
 * Asserts that a function throws an error with a specific message
 */
export const expectToThrow = async (
  fn: () => Promise<any> | any,
  expectedMessage?: string | RegExp
): Promise<void> => {
  let error: Error | undefined;
  
  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }
  
  if (!error) {
    throw new Error('Expected function to throw an error');
  }
  
  if (expectedMessage) {
    if (typeof expectedMessage === 'string') {
      expect(error.message).toContain(expectedMessage);
    } else {
      expect(error.message).toMatch(expectedMessage);
    }
  }
};