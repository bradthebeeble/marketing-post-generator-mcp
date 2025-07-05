import FirecrawlApp from '@mendable/firecrawl-js';
import { ISearchAdapter } from '../ISearchAdapter.js';
import { SearchOptions, SearchResult, DomainSampleResult, SearchAdapterConfig } from '../types.js';
import { createLogger } from '../../../utils/logger.js';
import winston from 'winston';

export interface FirecrawlConfig extends SearchAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  rateLimit?: number; // Requests per minute
  maxRetries?: number;
  timeoutMs?: number;
  maxCreditsPerDay?: number;
}

/**
 * Firecrawl Search Adapter that provides professional web scraping and crawling capabilities.
 * Uses the official Firecrawl API to extract clean, structured content from web pages.
 */
export class FirecrawlSearchAdapter implements ISearchAdapter {
  private readonly logger: winston.Logger;
  private client!: FirecrawlApp;
  private config!: Required<FirecrawlConfig>;
  private initialized = false;
  private lastRequestTime = 0;
  private dailyCreditsUsed = 0;
  private lastCreditReset = new Date().toDateString();

  constructor(logger?: winston.Logger) {
    this.logger = logger || createLogger({ level: 'info', format: 'simple' });
  }

  getName(): string {
    return 'firecrawl';
  }

  async initialize(config: FirecrawlConfig): Promise<void> {
    if (!config.apiKey) {
      throw new Error('Firecrawl adapter requires an API key');
    }

    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.firecrawl.dev',
      rateLimit: config.rateLimit || 30, // Default to 30 requests per minute
      maxRetries: config.maxRetries || 3,
      timeoutMs: config.timeoutMs || 30000, // 30 seconds
      maxCreditsPerDay: config.maxCreditsPerDay || 1000,
    };

    try {
      this.client = new FirecrawlApp({
        apiKey: this.config.apiKey,
        ...(this.config.baseUrl && { apiUrl: this.config.baseUrl }),
      });

      this.initialized = true;
      this.logger.info('FirecrawlSearchAdapter initialized', {
        baseUrl: this.config.baseUrl,
        rateLimit: this.config.rateLimit,
        maxRetries: this.config.maxRetries,
      });

      // Reset daily credits if it's a new day
      this.checkDailyCreditReset();
    } catch (error) {
      this.logger.error('Failed to initialize Firecrawl adapter', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Firecrawl adapter initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      // Test API connectivity with a simple scrape of Firecrawl's own docs
      await this.executeWithRetry(async () => {
        const result = await this.client.scrapeUrl('https://docs.firecrawl.dev/introduction', {
          formats: ['markdown'],
          onlyMainContent: true,
        });
        return result.success;
      });

      this.logger.debug('Firecrawl health check passed');
      return true;
    } catch (error) {
      this.logger.debug('Firecrawl health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async fetchContent(url: string): Promise<string> {
    this.ensureInitialized();

    try {
      this.logger.info('Fetching content via Firecrawl', { url });

      const result = await this.executeWithRetry(async () => {
        return await this.client.scrapeUrl(url, {
          formats: ['markdown'],
          onlyMainContent: true,
          includeTags: ['title', 'meta'],
          excludeTags: ['nav', 'footer', 'header', 'aside', 'script', 'style'],
        });
      });

      if (!result.success || !result.markdown) {
        throw new Error('No content returned from Firecrawl');
      }

      // Track credit usage - hardcoded to 1 since scrapeUrl API doesn't return actual credit usage
      // This is a conservative estimate as single URL scraping typically consumes 1 credit
      this.trackCreditUsage(1, true);

      this.logger.info('Content fetched successfully via Firecrawl', {
        url,
        contentLength: result.markdown.length,
      });

      return result.markdown;
    } catch (error) {
      this.logger.error('Error fetching content from Firecrawl', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to fetch content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async sampleDomain(domain: string, count: number): Promise<DomainSampleResult[]> {
    this.ensureInitialized();

    try {
      this.logger.info('Sampling domain via Firecrawl', { domain, count });

      const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;

      // Use Firecrawl's crawl functionality to discover blog posts
      const crawlResult = await this.executeWithRetry(async () => {
        return await this.client.crawlUrl(baseUrl, {
          limit: Math.min(count * 2, 50), // Request more than needed for filtering
          scrapeOptions: {
            formats: ['markdown'],
            onlyMainContent: true,
            includeTags: ['title', 'meta'],
            excludeTags: ['nav', 'footer', 'header', 'aside', 'script', 'style'],
          },
          allowBackwardLinks: false,
          allowExternalLinks: false,
          maxDepth: 2,
        });
      });

      if (!crawlResult.success || !crawlResult.data) {
        throw new Error('Failed to crawl domain with Firecrawl');
      }

      // Filter and select representative blog posts
      const blogPosts = this.filterBlogPosts(crawlResult.data, baseUrl);
      const selectedPosts = this.selectRepresentativeSample(blogPosts, count);

      // Track actual credit usage from API response, fallback to estimation
      const actualCredits = crawlResult.creditsUsed;
      if (actualCredits !== undefined) {
        this.trackCreditUsage(actualCredits, false);
      } else {
        this.trackCreditUsage(selectedPosts.length, true);
      }

      const results: DomainSampleResult[] = selectedPosts.map((post) => ({
        url: post.metadata?.sourceURL || post.url || '',
        content: post.markdown || '',
        title: post.metadata?.title,
        publishedDate: post.metadata?.publishedTime || post.metadata?.modifiedTime,
        author: post.metadata?.author,
        excerpt: post.metadata?.description,
      }));

      this.logger.info('Domain sampling completed via Firecrawl', {
        domain,
        requested: count,
        crawled: crawlResult.data.length,
        filtered: blogPosts.length,
        selected: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error('Error sampling domain with Firecrawl', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to sample domain: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      this.logger.info('Searching via Firecrawl', { query, options });

      // Use Firecrawl's search capability
      const searchResult = await this.executeWithRetry(async () => {
        return await this.client.search(query, {
          limit: options?.limit || 10,
          ...(options?.filters && { scrapeOptions: { ...options.filters } }),
        });
      });

      if (!searchResult.success || !searchResult.data) {
        this.logger.warn('Firecrawl search returned no results', { query });
        return [];
      }

      // Track credit usage - estimate since search API response doesn't include actual credits
      this.trackCreditUsage(searchResult.data.length, true);

      // Convert to standardized format
      const results: SearchResult[] = searchResult.data.map((item) => ({
        url: item.url || item.metadata?.sourceURL || '',
        title: item.metadata?.title || '',
        snippet: item.metadata?.description || '',
        ...(item.markdown && { content: item.markdown }),
      }));

      this.logger.info('Search completed via Firecrawl', {
        query,
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error('Error searching with Firecrawl', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('FirecrawlSearchAdapter not initialized. Call initialize() first.');
    }
  }

  private async executeWithRetry<T>(apiCall: () => Promise<T>): Promise<T> {
    let attempts = 0;

    while (attempts < this.config.maxRetries) {
      try {
        // Enforce rate limiting
        await this.enforceRateLimit();

        // Check daily credit limit
        this.checkCreditLimit();

        // Execute the API call
        const result = await apiCall();
        return result;
      } catch (error) {
        attempts++;

        if (this.isRetryableError(error) && attempts < this.config.maxRetries) {
          const delay = this.calculateBackoff(attempts);
          this.logger.warn('Retrying Firecrawl API call', {
            attempts,
            delay,
            error: error instanceof Error ? error.message : String(error),
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }

    throw new Error(`Failed after ${this.config.maxRetries} attempts`);
  }

  private isRetryableError(error: any): boolean {
    // Determine if error is retryable (rate limits, temporary server issues)
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')
      );
    }
    return false;
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter
    return Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = (60 * 1000) / this.config.rateLimit;

    if (now - this.lastRequestTime < minInterval) {
      const delay = minInterval - (now - this.lastRequestTime);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  private checkCreditLimit(): void {
    if (this.dailyCreditsUsed >= this.config.maxCreditsPerDay) {
      throw new Error('Daily Firecrawl credit limit exceeded');
    }
  }

  private trackCreditUsage(credits: number, isEstimated: boolean = false): void {
    // Check if we need to reset daily credit counter
    this.checkDailyCreditReset();

    this.dailyCreditsUsed += credits;

    this.logger.debug('Firecrawl API usage tracked', {
      credits,
      isEstimated,
      dailyUsage: this.dailyCreditsUsed,
      dailyLimit: this.config.maxCreditsPerDay,
    });

    // Warn about estimation inaccuracy if using fallback tracking
    if (isEstimated) {
      this.logger.debug('Credit usage is estimated - actual usage may differ', {
        estimatedCredits: credits,
      });
    }

    // Warn when approaching limit
    if (this.dailyCreditsUsed > this.config.maxCreditsPerDay * 0.8) {
      this.logger.warn('Firecrawl credit usage approaching daily limit', {
        used: this.dailyCreditsUsed,
        limit: this.config.maxCreditsPerDay,
        hasEstimatedUsage: isEstimated,
      });
    }
  }

  private checkDailyCreditReset(): void {
    const today = new Date().toDateString();
    if (this.lastCreditReset !== today) {
      this.dailyCreditsUsed = 0;
      this.lastCreditReset = today;
      this.logger.debug('Daily credit counter reset', { resetDate: today });
    }
  }

  private filterBlogPosts(crawlData: any[], baseUrl: string): any[] {
    return crawlData.filter((item) => {
      const url = item.metadata?.sourceURL || item.url || '';
      const title = item.metadata?.title || '';
      const content = item.markdown || '';

      // Basic filtering for blog-like content
      return (
        url &&
        title &&
        content.length > 200 && // Minimum content length
        this.isValidBlogUrl(url, baseUrl) &&
        !this.isExcludedContent(title.toLowerCase(), content.toLowerCase())
      );
    });
  }

  private isValidBlogUrl(url: string, baseUrl: string): boolean {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(baseUrl);

      // Must be from the same domain
      if (urlObj.hostname !== baseUrlObj.hostname) {
        return false;
      }

      const path = urlObj.pathname.toLowerCase();

      // Exclude common non-content URLs
      const excludePatterns = [
        '/tag/',
        '/category/',
        '/author/',
        '/search/',
        '/feed/',
        '/rss/',
        '/api/',
        '/admin/',
        '/wp-admin/',
        '/login/',
        '/register/',
        '/contact/',
        '/about/',
        '/privacy/',
        '/terms/',
        '.css',
        '.js',
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.svg',
        '.ico',
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.zip',
        '.rar',
      ];

      return !excludePatterns.some((pattern) => path.includes(pattern));
    } catch (error) {
      return false;
    }
  }

  private isExcludedContent(title: string, content: string): boolean {
    const excludeKeywords = [
      'cookie policy',
      'privacy policy',
      'terms of service',
      'sitemap',
      '404',
      'not found',
      'page not found',
      'error',
      'under construction',
    ];

    return excludeKeywords.some((keyword) => title.includes(keyword) || content.includes(keyword));
  }

  private selectRepresentativeSample(posts: any[], count: number): any[] {
    // Sort by content length (longer posts often have more substance)
    // and published date if available
    const sortedPosts = posts.sort((a, b) => {
      // Safe date parsing with validation
      const aDateStr = a.metadata?.publishedTime || a.metadata?.modifiedTime;
      const bDateStr = b.metadata?.publishedTime || b.metadata?.modifiedTime;

      let aDate = new Date('1970-01-01');
      let bDate = new Date('1970-01-01');

      if (aDateStr) {
        const parsedA = new Date(aDateStr);
        if (!isNaN(parsedA.getTime())) {
          aDate = parsedA;
        }
      }

      if (bDateStr) {
        const parsedB = new Date(bDateStr);
        if (!isNaN(parsedB.getTime())) {
          bDate = parsedB;
        }
      }

      // Normalize scores to avoid scale mismatch
      // Date score: days since epoch (reasonable scale 0-20000)
      const aDays = Math.floor(aDate.getTime() / (1000 * 60 * 60 * 24));
      const bDays = Math.floor(bDate.getTime() / (1000 * 60 * 60 * 24));

      // Content length score: length in thousands of characters (reasonable scale 0-50)
      const aContentScore = (a.markdown?.length || 0) / 1000;
      const bContentScore = (b.markdown?.length || 0) / 1000;

      // Combined score with balanced weighting
      const aScore = aDays + aContentScore;
      const bScore = bDays + bContentScore;

      return bScore - aScore;
    });

    return sortedPosts.slice(0, count);
  }
}
