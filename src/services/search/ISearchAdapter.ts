import { SearchOptions, SearchResult, DomainSampleResult, SearchAdapterConfig } from './types.js';

/**
 * Interface for search adapters that provide content fetching capabilities.
 * This allows for pluggable implementations (web scraping, Firecrawl, SerpAPI, etc.)
 */
export interface ISearchAdapter {
  /**
   * Fetch content from a single URL
   * @param url The URL to fetch content from
   * @returns Promise resolving to the content as a string
   */
  fetchContent(url: string): Promise<string>;

  /**
   * Sample multiple pages from a domain
   * @param domain The domain to sample from
   * @param count Number of pages to sample
   * @returns Promise resolving to array of sampled content
   */
  sampleDomain(domain: string, count: number): Promise<DomainSampleResult[]>;

  /**
   * Get search results for a query
   * @param query The search query
   * @param options Optional search parameters
   * @returns Promise resolving to search results
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  /**
   * Initialize the adapter with configuration
   * @param config Configuration object for the adapter
   * @returns Promise that resolves when initialization is complete
   */
  initialize(config: SearchAdapterConfig): Promise<void>;

  /**
   * Get the name/identifier of this adapter
   * @returns The adapter name
   */
  getName(): string;

  /**
   * Check if the adapter is properly configured and ready to use
   * @returns Promise resolving to true if healthy
   */
  healthCheck(): Promise<boolean>;
}
