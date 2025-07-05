// Shared types and interfaces for the search system

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
  timeout?: number;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
}

export interface DomainSampleResult {
  url: string;
  content: string;
  title?: string;
  publishedDate?: string;
  author?: string;
  excerpt?: string;
}

export interface SearchAdapterConfig {
  [key: string]: any;
}

export interface SearchConfig {
  defaultAdapter: string;
  fallbackAdapters: string[];
  adapterConfigs: Record<string, SearchAdapterConfig>;
}
