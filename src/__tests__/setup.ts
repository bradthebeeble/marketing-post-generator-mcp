// Global test setup for Jest

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.CLAUDE_API_KEY = 'test-claude-api-key';
process.env.PERPLEXITY_API_KEY = 'test-perplexity-api-key';
process.env.FIRECRAWL_API_KEY = 'test-firecrawl-api-key';

// Note: jest setup is handled by each test file individually