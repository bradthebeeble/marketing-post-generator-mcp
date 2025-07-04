import { GeneratedContent } from '../../types/index.js';

export interface ClaudeGenerationOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  stopSequences?: string[];
  stream?: boolean;
  metadata?: Record<string, any>;
}

export interface ClaudeResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model?: string;
  stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence';
}

export interface IClaudeService {
  generateContent(prompt: string, options?: ClaudeGenerationOptions): Promise<GeneratedContent>;
  
  streamContent(prompt: string, options?: ClaudeGenerationOptions): AsyncGenerator<string, void, unknown>;
  
  isHealthy(): Promise<boolean>;
  
  getRemainingQuota(): Promise<{ requests: number; tokens: number } | null>;
  
  validateApiKey(): Promise<boolean>;
}