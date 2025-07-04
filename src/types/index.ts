// Core type definitions for the Marketing Post Generator MCP

export interface ServerConfig {
  server: {
    mode: 'local' | 'remote';
    transport: 'stdio' | 'http';
    port?: number;
    host?: string;
    http?: {
      enableJsonResponse?: boolean;
      enableDnsRebindingProtection?: boolean;
      allowedHosts?: string[];
      allowedOrigins?: string[];
      sessionIdGenerator?: (() => string) | undefined;
    };
  };
  postgen: {
    dataDir: string;
    cacheEnabled: boolean;
    cacheTtl: number;
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
    format: 'simple' | 'json' | 'pretty';
  };
  cors?: {
    allowedOrigins: string[];
    allowedHeaders: string[];
    credentials?: boolean;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: any;
  handler: (params: any, context: any) => Promise<any>;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface ToolFactory {
  createTool(): MCPTool;
  getToolName(): string;
  getToolDescription(): string;
}

export interface PromptFactory {
  createPrompt(): MCPPrompt;
  getPromptName(): string;
  getPromptDescription(): string;
}

export interface GenerationContext {
  domain?: string;
  contentType: ContentType;
  parameters: Record<string, any>;
}

export enum ContentType {
  BLOG_POST = 'blog_post',
  NARRATIVE = 'narrative',
  SUMMARY = 'summary',
  CONTENT_PLAN = 'content_plan',
  TONE_ANALYSIS = 'tone_analysis',
}

export interface UsageMetadata {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface GeneratedContent {
  content: string;
  metadata: {
    model?: string;
    usage?: UsageMetadata;
    duration: number;
  };
}
