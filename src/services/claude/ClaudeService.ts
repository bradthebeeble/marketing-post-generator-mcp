import Anthropic from '@anthropic-ai/sdk';
import { IClaudeService, ClaudeGenerationOptions } from './IClaudeService.js';
import { GeneratedContent } from '../../types/index.js';
import { ServerConfig } from '../../types/index.js';
import { createLogger } from '../../utils/logger.js';
import winston from 'winston';

const CLAUDE_MODELS = {
  DEFAULT: 'claude-3-sonnet-20240229',
  CHEAP: 'claude-3-haiku-20240307',
} as const;

export class ClaudeService implements IClaudeService {
  private client: Anthropic;
  private config: ServerConfig['claude'];
  private logger: winston.Logger;
  private rateLimiter: {
    requests: { count: number; resetTime: number };
    tokens: { count: number; resetTime: number };
  };

  constructor(config: ServerConfig['claude']) {
    this.config = config;
    this.logger = createLogger({ level: 'info', format: 'simple' });
    
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl && { baseURL: config.baseUrl }),
      ...(config.timeout && { timeout: config.timeout }),
      ...(config.maxRetries && { maxRetries: config.maxRetries }),
    });

    this.rateLimiter = {
      requests: { count: 0, resetTime: Date.now() + 60000 },
      tokens: { count: 0, resetTime: Date.now() + 60000 },
    };

    this.logger.info('Claude service initialized', {
      baseUrl: config.baseUrl,
      maxRetries: config.maxRetries,
      timeout: config.timeout,
      rateLimit: config.rateLimit,
    });
  }

  async generateContent(prompt: string, options: ClaudeGenerationOptions = {}): Promise<GeneratedContent> {
    const startTime = Date.now();
    
    try {
      await this.checkRateLimit();

      const createParams: any = {
        model: options.model || CLAUDE_MODELS.DEFAULT,
        max_tokens: options.maxTokens || 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      };

      if (options.temperature !== undefined) createParams.temperature = options.temperature;
      if (options.topK !== undefined) createParams.top_k = options.topK;
      if (options.topP !== undefined) createParams.top_p = options.topP;
      if (options.stopSequences !== undefined) createParams.stop_sequences = options.stopSequences;
      if (options.metadata !== undefined) createParams.metadata = options.metadata;

      const response = await this.client.messages.create(createParams);

      this.updateRateLimit(response.usage?.input_tokens || 0, response.usage?.output_tokens || 0);

      const duration = Date.now() - startTime;
      const content = response.content[0]?.type === 'text' ? response.content[0].text : '';

      this.logger.debug('Content generated successfully', {
        model: response.model,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        duration,
      });

      return {
        content,
        metadata: {
          model: response.model,
          usage: {
            promptTokens: response.usage?.input_tokens,
            completionTokens: response.usage?.output_tokens,
            totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
          },
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Failed to generate content', {
        error: error instanceof Error ? error.message : String(error),
        duration,
        prompt: prompt.substring(0, 100) + '...',
      });

      if (error instanceof Anthropic.APIError) {
        throw new Error(`Claude API error (${error.status}): ${error.message}`);
      } else if (error instanceof Anthropic.RateLimitError) {
        throw new Error('Claude API rate limit exceeded. Please try again later.');
      } else if (error instanceof Anthropic.AuthenticationError) {
        throw new Error('Claude API authentication failed. Please check your API key.');
      } else {
        throw new Error(`Claude service error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  async *streamContent(prompt: string, options: ClaudeGenerationOptions = {}): AsyncGenerator<string, void, unknown> {
    try {
      await this.checkRateLimit();

      const streamParams: any = {
        model: options.model || CLAUDE_MODELS.DEFAULT,
        max_tokens: options.maxTokens || 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
      };

      if (options.temperature !== undefined) streamParams.temperature = options.temperature;
      if (options.topK !== undefined) streamParams.top_k = options.topK;
      if (options.topP !== undefined) streamParams.top_p = options.topP;
      if (options.stopSequences !== undefined) streamParams.stop_sequences = options.stopSequences;
      if (options.metadata !== undefined) streamParams.metadata = options.metadata;

      const stream = this.client.messages.stream(streamParams);
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            yield chunk.delta.text;
          } else if (chunk.type === 'message_stop' && chunk.message?.usage) {
            totalInputTokens = chunk.message.usage.input_tokens || 0;
            totalOutputTokens = chunk.message.usage.output_tokens || 0;
          }
        }
      } finally {
        // Update rate limits with the tokens used
        this.updateRateLimit(totalInputTokens, totalOutputTokens);
      }

    } catch (error) {
      this.logger.error('Failed to stream content', {
        error: error instanceof Error ? error.message : String(error),
        prompt: prompt.substring(0, 100) + '...',
      });

      throw new Error(`Claude stream error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.messages.create({
        model: CLAUDE_MODELS.CHEAP,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      });

      return response.content.length > 0;
    } catch (error) {
      this.logger.warn('Claude health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async getRemainingQuota(): Promise<{ requests: number; tokens: number } | null> {
    try {
      const now = Date.now();
      
      if (now > this.rateLimiter.requests.resetTime) {
        this.rateLimiter.requests = { count: 0, resetTime: now + 60000 };
      }
      
      if (now > this.rateLimiter.tokens.resetTime) {
        this.rateLimiter.tokens = { count: 0, resetTime: now + 60000 };
      }

      return {
        requests: Math.max(0, (this.config.rateLimit?.requestsPerMinute || 60) - this.rateLimiter.requests.count),
        tokens: Math.max(0, (this.config.rateLimit?.tokensPerMinute || 50000) - this.rateLimiter.tokens.count),
      };
    } catch (error) {
      this.logger.warn('Failed to get remaining quota', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.client.messages.create({
        model: CLAUDE_MODELS.CHEAP,
        max_tokens: 5,
        messages: [
          {
            role: 'user',
            content: 'Test',
          },
        ],
      });

      return response.content.length > 0;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        return false;
      }
      
      this.logger.warn('API key validation failed with non-auth error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    if (now > this.rateLimiter.requests.resetTime) {
      this.rateLimiter.requests = { count: 0, resetTime: now + 60000 };
    }
    
    if (now > this.rateLimiter.tokens.resetTime) {
      this.rateLimiter.tokens = { count: 0, resetTime: now + 60000 };
    }

    const maxRequests = this.config.rateLimit?.requestsPerMinute || 60;
    
    if (this.rateLimiter.requests.count >= maxRequests) {
      const waitTime = this.rateLimiter.requests.resetTime - now;
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
  }

  private updateRateLimit(inputTokens: number, outputTokens: number): void {
    this.rateLimiter.requests.count += 1;
    this.rateLimiter.tokens.count += inputTokens + outputTokens;

    this.logger.debug('Rate limit updated', {
      requestCount: this.rateLimiter.requests.count,
      tokenCount: this.rateLimiter.tokens.count,
      inputTokens,
      outputTokens,
    });
  }
}