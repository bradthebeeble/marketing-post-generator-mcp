import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { ISearchAdapter } from '../ISearchAdapter.js';
import { SearchOptions, SearchResult, DomainSampleResult, SearchAdapterConfig } from '../types.js';
import { createLogger } from '../../../utils/logger.js';
import winston from 'winston';

export interface WebScrapingConfig extends SearchAdapterConfig {
  sampleSize?: number;
  maxRequestsPerSecond?: number;
  timeout?: number;
  userAgent?: string;
}

export interface ScrapedBlogPost {
  title: string;
  content: string;
  url: string;
  publishedDate?: string;
  author?: string;
  excerpt?: string;
}

/**
 * Web scraping adapter that implements the ISearchAdapter interface.
 * Migrates existing WebScrapingService logic to the adapter pattern.
 */
export class WebScrapingAdapter implements ISearchAdapter {
  private readonly logger: winston.Logger;
  private httpClient!: AxiosInstance;
  private config!: Required<WebScrapingConfig>;
  private lastRequestTime = 0;
  private initialized = false;

  constructor(logger?: winston.Logger) {
    this.logger = logger || createLogger({ level: 'info', format: 'simple' });
  }

  getName(): string {
    return 'web-scraping';
  }

  async initialize(config: WebScrapingConfig): Promise<void> {
    this.config = {
      sampleSize: config.sampleSize || 5,
      maxRequestsPerSecond: config.maxRequestsPerSecond || 2,
      timeout: config.timeout || 30000,
      userAgent: config.userAgent || 'Mozilla/5.0 (compatible; MarketingPostGenerator/1.0)',
    };

    this.httpClient = axios.create({
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    this.initialized = true;
    this.logger.info('WebScrapingAdapter initialized', { config: this.config });
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      // Test with a simple HTTP request to a reliable endpoint
      const response = await this.httpClient.get('https://httpbin.org/user-agent', {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      this.logger.debug('Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async fetchContent(url: string): Promise<string> {
    this.ensureInitialized();
    
    try {
      this.logger.info('Fetching single blog post', { url });
      await this.respectRateLimit();
      const post = await this.fetchBlogPost(url);
      
      if (!post) {
        throw new Error(`No content found at URL: ${url}`);
      }
      
      return post.content;
    } catch (error) {
      this.logger.error('Failed to fetch content', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to fetch content from ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async sampleDomain(domain: string, count: number): Promise<DomainSampleResult[]> {
    this.ensureInitialized();

    try {
      this.logger.info('Starting domain sampling', { domain, count });

      // Step 1: Discover blog posts
      const postUrls = await this.discoverBlogPosts(domain, count);

      if (postUrls.length === 0) {
        this.logger.warn('No blog posts found', { domain });
        return [];
      }

      // Step 2: Fetch and parse individual posts
      const results: DomainSampleResult[] = [];

      for (const url of postUrls) {
        try {
          await this.respectRateLimit();
          const post = await this.fetchBlogPost(url);
          if (post) {
            results.push({
              url: post.url,
              content: post.content,
              ...(post.title && { title: post.title }),
              ...(post.publishedDate && { publishedDate: post.publishedDate }),
              ...(post.author && { author: post.author }),
              ...(post.excerpt && { excerpt: post.excerpt }),
            });
          }
        } catch (error) {
          this.logger.warn('Failed to fetch blog post during sampling', {
            url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('Domain sampling completed', {
        domain,
        requested: count,
        found: postUrls.length,
        extracted: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error('Domain sampling failed', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to sample domain ${domain}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    this.ensureInitialized();
    
    // Basic implementation - can be enhanced to use actual search engines
    this.logger.warn('Basic search implementation - limited functionality', { query, options });
    
    // For now, return empty results as this adapter is primarily for domain sampling
    // Future implementations could integrate with search engines
    return [];
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('WebScrapingAdapter not initialized. Call initialize() first.');
    }
  }

  private async discoverBlogPosts(domain: string, sampleSize: number): Promise<string[]> {
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const postUrls: string[] = [];

    try {
      // Try common blog discovery strategies
      const discoveryUrls = [
        baseUrl,
        `${baseUrl}/blog`,
        `${baseUrl}/posts`,
        `${baseUrl}/articles`,
        `${baseUrl}/news`,
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/feed`,
        `${baseUrl}/rss`,
        `${baseUrl}/atom.xml`,
      ];

      for (const url of discoveryUrls) {
        try {
          await this.respectRateLimit();
          const discoveredUrls = await this.extractPostUrls(url, baseUrl);
          postUrls.push(...discoveredUrls);

          if (postUrls.length >= sampleSize) {
            break;
          }
        } catch (error) {
          this.logger.debug('Failed to discover posts from URL', {
            url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Remove duplicates and limit to sample size
      const uniqueUrls = [...new Set(postUrls)];
      return uniqueUrls.slice(0, sampleSize);
    } catch (error) {
      this.logger.error('Post discovery failed', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async extractPostUrls(url: string, baseUrl: string): Promise<string[]> {
    try {
      const response = await this.httpClient.get(url);
      const $ = cheerio.load(response.data);
      const postUrls: string[] = [];

      // Check if it's an XML sitemap or RSS feed
      if (response.headers['content-type']?.includes('xml')) {
        return this.extractUrlsFromXml(response.data, baseUrl);
      }

      // Extract URLs from HTML
      const selectors = [
        'article a[href]',
        '.post a[href]',
        '.blog-post a[href]',
        '.entry a[href]',
        'h1 a[href]',
        'h2 a[href]',
        'h3 a[href]',
        'a[href*="/post/"]',
        'a[href*="/blog/"]',
        'a[href*="/article/"]',
        'a[href*="/news/"]',
        'a[href*="/"]',
      ];

      for (const selector of selectors) {
        $(selector).each((_, element) => {
          const href = $(element).attr('href');
          if (href) {
            const fullUrl = this.resolveUrl(href, baseUrl);
            if (this.isValidPostUrl(fullUrl, baseUrl)) {
              postUrls.push(fullUrl);
            }
          }
        });

        if (postUrls.length >= 20) break; // Limit discovery per page
      }

      return postUrls;
    } catch (error) {
      this.logger.debug('Failed to extract post URLs', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private extractUrlsFromXml(xmlContent: string, baseUrl: string): string[] {
    const $ = cheerio.load(xmlContent, { xmlMode: true });
    const urls: string[] = [];

    // Handle sitemap XML
    $('url loc').each((_, element) => {
      const url = $(element).text();
      if (this.isValidPostUrl(url, baseUrl)) {
        urls.push(url);
      }
    });

    // Handle RSS/Atom feeds
    $('item link, entry link').each((_, element) => {
      const url = $(element).text() || $(element).attr('href');
      if (url && this.isValidPostUrl(url, baseUrl)) {
        urls.push(url);
      }
    });

    return urls;
  }

  private async fetchBlogPost(url: string): Promise<ScrapedBlogPost | null> {
    try {
      const response = await this.httpClient.get(url);
      const $ = cheerio.load(response.data);

      // Extract title
      const title = this.extractTitle($);
      if (!title) {
        this.logger.debug('No title found, skipping post', { url });
        return null;
      }

      // Extract content
      const content = this.extractContent($);
      if (!content || content.length < 100) {
        this.logger.debug('Insufficient content, skipping post', {
          url,
          contentLength: content?.length,
        });
        return null;
      }

      // Extract metadata
      const publishedDate = this.extractPublishedDate($);
      const author = this.extractAuthor($);
      const excerpt = this.extractExcerpt($, content);

      return {
        title,
        content,
        url,
        ...(publishedDate && { publishedDate }),
        ...(author && { author }),
        ...(excerpt && { excerpt }),
      };
    } catch (error) {
      this.logger.debug('Failed to fetch blog post', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private extractTitle($: cheerio.Root): string | null {
    const selectors = [
      'article h1',
      '.post-title',
      '.entry-title',
      'h1.title',
      'h1',
      'title',
      '[property="og:title"]',
      '[name="twitter:title"]',
    ];

    for (const selector of selectors) {
      const title = $(selector).first().text().trim();
      if (title && title.length > 0) {
        return title;
      }
    }

    return null;
  }

  private extractContent($: cheerio.Root): string | null {
    const selectors = [
      'article .content',
      'article .post-content',
      'article .entry-content',
      '.post-body',
      '.entry-body',
      '.content',
      'article',
      'main',
    ];

    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        // Remove unwanted elements
        element.find('script, style, nav, footer, header, aside, .comments, .sidebar').remove();

        const content = element.text().trim();
        if (content && content.length > 100) {
          return content;
        }
      }
    }

    return null;
  }

  private extractPublishedDate($: cheerio.Root): string | undefined {
    const selectors = [
      '[property="article:published_time"]',
      '[name="article:published_time"]',
      'time[datetime]',
      '.published-date',
      '.post-date',
      '.entry-date',
    ];

    for (const selector of selectors) {
      const date =
        $(selector).attr('content') || $(selector).attr('datetime') || $(selector).text();
      if (date) {
        try {
          const parsedDate = new Date(date);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        } catch (error) {
          this.logger.debug('Failed to parse date', { date, error });
        }
      }
    }

    return undefined;
  }

  private extractAuthor($: cheerio.Root): string | undefined {
    const selectors = [
      '[property="article:author"]',
      '[name="author"]',
      '.author',
      '.post-author',
      '.entry-author',
    ];

    for (const selector of selectors) {
      const author = $(selector).attr('content') || $(selector).text();
      if (author && author.trim().length > 0) {
        return author.trim();
      }
    }

    return undefined;
  }

  private extractExcerpt($: cheerio.Root, content: string): string | undefined {
    const selectors = [
      '[property="og:description"]',
      '[name="description"]',
      '.excerpt',
      '.post-excerpt',
    ];

    for (const selector of selectors) {
      const excerpt = $(selector).attr('content') || $(selector).text();
      if (excerpt && excerpt.trim().length > 0) {
        return excerpt.trim();
      }
    }

    // Fallback to first paragraph or truncated content
    if (content) {
      const firstParagraph = content.split('\n')[0];
      if (firstParagraph && firstParagraph.length > 50) {
        return firstParagraph.length > 200
          ? firstParagraph.substring(0, 197) + '...'
          : firstParagraph;
      }
    }

    return undefined;
  }

  private resolveUrl(href: string, baseUrl: string): string {
    if (href.startsWith('http')) {
      return href;
    }

    if (href.startsWith('/')) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${href}`;
    }

    return new URL(href, baseUrl).toString();
  }

  private isValidPostUrl(url: string, baseUrl: string): boolean {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(baseUrl);

      // Must be from the same domain
      if (urlObj.hostname !== baseUrlObj.hostname) {
        return false;
      }

      // Must be HTTP/HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false;
      }

      // Filter out common non-content URLs
      const path = urlObj.pathname.toLowerCase();
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
        '/wp-content/',
        '/wp-includes/',
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

  private async respectRateLimit(): Promise<void> {
    const minInterval = 1000 / this.config.maxRequestsPerSecond;
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}