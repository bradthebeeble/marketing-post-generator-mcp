import { ISearchAdapter } from './ISearchAdapter.js';
import { SearchOptions, SearchResult, DomainSampleResult } from './types.js';
import { createLogger } from '../../utils/logger.js';
import winston from 'winston';

/**
 * Main search service that provides a unified interface to search adapters
 * with fallback support and error handling.
 */
export class SearchService {
  private readonly logger: winston.Logger;
  private adapter: ISearchAdapter;
  private readonly fallbackAdapters: ISearchAdapter[] = [];

  constructor(
    primaryAdapter: ISearchAdapter,
    fallbacks: ISearchAdapter[] = [],
    logger?: winston.Logger
  ) {
    this.logger = logger || createLogger({ level: 'info', format: 'simple' });
    this.adapter = primaryAdapter;
    this.fallbackAdapters = fallbacks;

    this.logger.info('SearchService initialized', {
      primaryAdapter: primaryAdapter.getName(),
      fallbackCount: fallbacks.length,
      fallbackAdapters: fallbacks.map((adapter) => adapter.getName()),
    });
  }

  /**
   * Set a new primary adapter
   * @param adapter The new primary adapter to use
   */
  public setAdapter(adapter: ISearchAdapter): void {
    const previousName = this.adapter.getName();
    this.adapter = adapter;
    this.logger.info('Primary search adapter changed', {
      from: previousName,
      to: adapter.getName(),
    });
  }

  /**
   * Add a fallback adapter
   * @param adapter The fallback adapter to add
   */
  public addFallbackAdapter(adapter: ISearchAdapter): void {
    this.fallbackAdapters.push(adapter);
    this.logger.info('Fallback adapter added', {
      adapter: adapter.getName(),
      totalFallbacks: this.fallbackAdapters.length,
    });
  }

  /**
   * Get the current primary adapter name
   * @returns The name of the primary adapter
   */
  public getPrimaryAdapterName(): string {
    return this.adapter.getName();
  }

  /**
   * Get the names of all fallback adapters
   * @returns Array of fallback adapter names
   */
  public getFallbackAdapterNames(): string[] {
    return this.fallbackAdapters.map((adapter) => adapter.getName());
  }

  /**
   * Fetch content from a URL with fallback support
   * @param url The URL to fetch content from
   * @returns Promise resolving to the content
   */
  public async fetchContent(url: string): Promise<string> {
    const startTime = Date.now();
    this.logger.info('Fetching content', { url, primaryAdapter: this.adapter.getName() });

    try {
      const content = await this.adapter.fetchContent(url);
      const duration = Date.now() - startTime;
      this.logger.info('Content fetched successfully', {
        url,
        adapter: this.adapter.getName(),
        duration,
        contentLength: content.length,
      });
      return content;
    } catch (error) {
      this.logger.warn('Primary adapter failed, trying fallbacks', {
        url,
        primaryAdapter: this.adapter.getName(),
        error: error instanceof Error ? error.message : String(error),
        fallbacksAvailable: this.fallbackAdapters.length,
      });

      // Try fallback adapters
      for (const fallbackAdapter of this.fallbackAdapters) {
        try {
          this.logger.debug('Trying fallback adapter', {
            url,
            adapter: fallbackAdapter.getName(),
          });

          const content = await fallbackAdapter.fetchContent(url);
          const duration = Date.now() - startTime;

          this.logger.info('Content fetched with fallback adapter', {
            url,
            adapter: fallbackAdapter.getName(),
            duration,
            contentLength: content.length,
          });

          return content;
        } catch (fallbackError) {
          this.logger.debug('Fallback adapter failed', {
            url,
            adapter: fallbackAdapter.getName(),
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.error('All adapters failed to fetch content', {
        url,
        duration,
        adaptersAttempted: 1 + this.fallbackAdapters.length,
      });

      throw new Error(
        `Failed to fetch content from ${url} with all adapters. Primary: ${this.adapter.getName()}, Fallbacks: ${this.fallbackAdapters.map((a) => a.getName()).join(', ')}`
      );
    }
  }

  /**
   * Sample domain with fallback support
   * @param domain The domain to sample from
   * @param count Number of samples to collect
   * @returns Promise resolving to array of sampled content
   */
  public async sampleDomain(domain: string, count: number): Promise<DomainSampleResult[]> {
    const startTime = Date.now();
    this.logger.info('Sampling domain', {
      domain,
      count,
      primaryAdapter: this.adapter.getName(),
    });

    try {
      const samples = await this.adapter.sampleDomain(domain, count);
      const duration = Date.now() - startTime;

      this.logger.info('Domain sampled successfully', {
        domain,
        adapter: this.adapter.getName(),
        requestedCount: count,
        actualCount: samples.length,
        duration,
      });

      return samples;
    } catch (error) {
      this.logger.warn('Primary adapter failed, trying fallbacks', {
        domain,
        primaryAdapter: this.adapter.getName(),
        error: error instanceof Error ? error.message : String(error),
        fallbacksAvailable: this.fallbackAdapters.length,
      });

      // Try fallback adapters
      for (const fallbackAdapter of this.fallbackAdapters) {
        try {
          this.logger.debug('Trying fallback adapter', {
            domain,
            adapter: fallbackAdapter.getName(),
          });

          const samples = await fallbackAdapter.sampleDomain(domain, count);
          const duration = Date.now() - startTime;

          this.logger.info('Domain sampled with fallback adapter', {
            domain,
            adapter: fallbackAdapter.getName(),
            requestedCount: count,
            actualCount: samples.length,
            duration,
          });

          return samples;
        } catch (fallbackError) {
          this.logger.debug('Fallback adapter failed', {
            domain,
            adapter: fallbackAdapter.getName(),
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.error('All adapters failed to sample domain', {
        domain,
        duration,
        adaptersAttempted: 1 + this.fallbackAdapters.length,
      });

      throw new Error(
        `Failed to sample domain ${domain} with all adapters. Primary: ${this.adapter.getName()}, Fallbacks: ${this.fallbackAdapters.map((a) => a.getName()).join(', ')}`
      );
    }
  }

  /**
   * Search with fallback support
   * @param query The search query
   * @param options Optional search parameters
   * @returns Promise resolving to search results
   */
  public async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const startTime = Date.now();
    this.logger.info('Performing search', {
      query,
      options,
      primaryAdapter: this.adapter.getName(),
    });

    try {
      const results = await this.adapter.search(query, options);
      const duration = Date.now() - startTime;

      this.logger.info('Search completed successfully', {
        query,
        adapter: this.adapter.getName(),
        resultCount: results.length,
        duration,
      });

      return results;
    } catch (error) {
      this.logger.warn('Primary adapter failed, trying fallbacks', {
        query,
        primaryAdapter: this.adapter.getName(),
        error: error instanceof Error ? error.message : String(error),
        fallbacksAvailable: this.fallbackAdapters.length,
      });

      // Try fallback adapters
      for (const fallbackAdapter of this.fallbackAdapters) {
        try {
          this.logger.debug('Trying fallback adapter', {
            query,
            adapter: fallbackAdapter.getName(),
          });

          const results = await fallbackAdapter.search(query, options);
          const duration = Date.now() - startTime;

          this.logger.info('Search completed with fallback adapter', {
            query,
            adapter: fallbackAdapter.getName(),
            resultCount: results.length,
            duration,
          });

          return results;
        } catch (fallbackError) {
          this.logger.debug('Fallback adapter failed', {
            query,
            adapter: fallbackAdapter.getName(),
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.error('All adapters failed to perform search', {
        query,
        duration,
        adaptersAttempted: 1 + this.fallbackAdapters.length,
      });

      throw new Error(
        `Failed to search for "${query}" with all adapters. Primary: ${this.adapter.getName()}, Fallbacks: ${this.fallbackAdapters.map((a) => a.getName()).join(', ')}`
      );
    }
  }

  /**
   * Check health of all adapters
   * @returns Promise resolving to health status of primary and fallback adapters
   */
  public async healthCheck(): Promise<{
    primary: { name: string; healthy: boolean; error?: string };
    fallbacks: Array<{ name: string; healthy: boolean; error?: string }>;
  }> {
    this.logger.debug('Performing health check on all adapters');

    // Check primary adapter
    let primaryHealthy = false;
    let primaryError: string | undefined;
    try {
      primaryHealthy = await this.adapter.healthCheck();
    } catch (error) {
      primaryError = error instanceof Error ? error.message : String(error);
    }

    // Check fallback adapters
    const fallbackResults = await Promise.allSettled(
      this.fallbackAdapters.map(async (adapter) => {
        try {
          const healthy = await adapter.healthCheck();
          return { name: adapter.getName(), healthy };
        } catch (error) {
          return {
            name: adapter.getName(),
            healthy: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })
    );

    const fallbacks = fallbackResults.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : { name: 'unknown', healthy: false, error: 'Promise rejected' }
    );

    const healthStatus = {
      primary: {
        name: this.adapter.getName(),
        healthy: primaryHealthy,
        ...(primaryError && { error: primaryError }),
      },
      fallbacks,
    };

    this.logger.debug('Health check completed', healthStatus);
    return healthStatus;
  }
}
