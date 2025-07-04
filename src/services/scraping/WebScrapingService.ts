import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { createLogger } from '../../utils/logger.js';
import winston from 'winston';

export interface BlogPost {
  title: string;
  content: string;
  url: string;
  publishedDate?: string;
  author?: string;
  excerpt?: string;
}

export interface ScrapingOptions {
  sampleSize?: number;
  maxRequestsPerSecond?: number;
  timeout?: number;
  userAgent?: string;
}

export class WebScrapingService {
  private readonly logger: winston.Logger;
  private readonly httpClient: AxiosInstance;
  private readonly defaultOptions: Required<ScrapingOptions>;
  private lastRequestTime = 0;

  constructor(options: ScrapingOptions = {}) {
    this.logger = createLogger({ level: 'info', format: 'simple' });

    this.defaultOptions = {
      sampleSize: options.sampleSize || 5,
      maxRequestsPerSecond: options.maxRequestsPerSecond || 2,
      timeout: options.timeout || 30000,
      userAgent: options.userAgent || 'Mozilla/5.0 (compatible; MarketingPostGenerator/1.0)',
    };

    this.httpClient = axios.create({
      timeout: this.defaultOptions.timeout,
      headers: {
        'User-Agent': this.defaultOptions.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });
  }

  async fetchSingleBlogPost(url: string): Promise<BlogPost | null> {
    try {
      this.logger.info('Fetching single blog post', { url });
      await this.respectRateLimit(this.defaultOptions.maxRequestsPerSecond);
      const post = await this.fetchBlogPost(url);
      return post;
    } catch (error) {
      this.logger.error('Failed to fetch single blog post', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to fetch blog post from ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async sampleBlogPosts(domain: string, options: ScrapingOptions = {}): Promise<BlogPost[]> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    try {
      this.logger.info('Starting blog post sampling', {
        domain,
        sampleSize: mergedOptions.sampleSize,
      });

      // Step 1: Discover blog posts
      const postUrls = await this.discoverBlogPosts(domain, mergedOptions.sampleSize);

      if (postUrls.length === 0) {
        this.logger.warn('No blog posts found', { domain });
        return [];
      }

      // Step 2: Fetch and parse individual posts
      const posts: BlogPost[] = [];

      for (const url of postUrls) {
        try {
          await this.respectRateLimit(mergedOptions.maxRequestsPerSecond);
          const post = await this.fetchBlogPost(url);
          if (post) {
            posts.push(post);
          }
        } catch (error) {
          this.logger.warn('Failed to fetch blog post', {
            url,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('Blog post sampling completed', {
        domain,
        requested: mergedOptions.sampleSize,
        found: postUrls.length,
        extracted: posts.length,
      });

      return posts;
    } catch (error) {
      this.logger.error('Blog post sampling failed', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to sample blog posts from ${domain}: ${error instanceof Error ? error.message : String(error)}`
      );
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
          await this.respectRateLimit(this.defaultOptions.maxRequestsPerSecond);
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

  private async fetchBlogPost(url: string): Promise<BlogPost | null> {
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

  private async respectRateLimit(maxRequestsPerSecond: number): Promise<void> {
    const minInterval = 1000 / maxRequestsPerSecond;
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}
