import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SearchService } from '../services/search/index.js';
import { IClaudeService } from '../services/claude/IClaudeService.js';
import { createLogger } from '../utils/logger.js';
import winston from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface SummarizeToolArgs {
  url: string;
}

export interface SummaryResult {
  url: string;
  title: string;
  summary: string;
  timestamp: string;
}

export class SummarizeTool {
  private readonly logger: winston.Logger;
  private readonly searchService: SearchService;

  constructor(searchService: SearchService, logger?: winston.Logger) {
    this.logger = logger || createLogger({ level: 'info', format: 'simple' });
    this.searchService = searchService;
  }

  getToolDefinition(): Tool {
    return {
      name: 'summarize',
      description:
        'Generate a concise summary of a blog post from its URL. This tool fetches the content of a specific blog post and creates an AI-generated summary that captures the main points and key insights.',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the blog post to summarize',
          },
        },
        required: ['url'],
      },
    };
  }

  async execute(args: SummarizeToolArgs, claudeService: IClaudeService): Promise<string> {
    const { url } = args;

    try {
      this.logger.info('Starting summarize tool execution', { url });

      // Validate URL format
      this.validateUrl(url);

      // Validate .postgen directory exists
      await this.validatePostgenDirectory();

      // Generate URL hash for caching
      const urlHash = this.generateUrlHash(url);
      const summaryPath = path.join(process.cwd(), '.postgen', 'summaries', `${urlHash}.json`);

      // Check for existing summary (cache hit)
      const existingSummary = await this.checkExistingSummary(summaryPath);
      if (existingSummary) {
        this.logger.info('Returning cached summary', { url, cached: true });
        return this.formatResponse(existingSummary);
      }

      // Fetch blog post content using SearchService
      this.logger.info('Fetching blog post content', { url });
      const content = await this.searchService.fetchContent(url);

      if (!content) {
        throw new Error(
          `Unable to fetch content from URL: ${url}. Please verify the URL is accessible and contains blog content.`
        );
      }

      this.logger.info('Blog post content fetched successfully', {
        url,
        contentLength: content.length,
      });

      // Extract title from content (basic implementation)
      const title = this.extractTitleFromContent(content, url);

      // Generate summary with Claude
      this.logger.info('Generating summary with Claude', { url });
      const summary = await this.generateSummary(title, content, claudeService);

      // Prepare result
      const result: SummaryResult = {
        url,
        title,
        summary,
        timestamp: new Date().toISOString(),
      };

      // Save result
      await this.saveResult(result, summaryPath);

      this.logger.info('Summarize tool execution completed successfully', { url });

      return this.formatResponse(result);
    } catch (error) {
      this.logger.error('Summarize tool execution failed', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to summarize blog post from ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private validateUrl(url: string): void {
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('URL must use HTTP or HTTPS protocol');
      }
    } catch (error) {
      throw new Error(`Invalid URL format: ${url}`);
    }
  }

  private async validatePostgenDirectory(): Promise<void> {
    const postgenDir = path.join(process.cwd(), '.postgen');

    try {
      await fs.access(postgenDir);
    } catch (error) {
      throw new Error(
        'The .postgen directory does not exist. Please run the init tool first to set up the project structure.'
      );
    }

    // Ensure summaries directory exists
    const summariesDir = path.join(postgenDir, 'summaries');
    try {
      await fs.access(summariesDir);
    } catch (error) {
      await fs.mkdir(summariesDir, { recursive: true });
      this.logger.info('Created summaries directory', { summariesDir });
    }
  }

  private generateUrlHash(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
  }

  private async checkExistingSummary(summaryPath: string): Promise<SummaryResult | null> {
    try {
      const existingContent = await fs.readFile(summaryPath, 'utf-8');
      return JSON.parse(existingContent) as SummaryResult;
    } catch (error) {
      // No existing summary found
      return null;
    }
  }

  private async generateSummary(
    title: string,
    content: string,
    claudeService: IClaudeService
  ): Promise<string> {
    const summaryPrompt = this.buildSummaryPrompt(title, content);

    const response = await claudeService.generateContent(summaryPrompt, {
      maxTokens: 1024,
      temperature: 0.3,
    });

    return response.content.trim();
  }

  private buildSummaryPrompt(title: string, content: string): string {
    // Truncate content if too long to fit in prompt
    const maxContentLength = 4000;
    const truncatedContent =
      content.length > maxContentLength ? content.substring(0, maxContentLength) + '...' : content;

    return `You are a professional content analyst tasked with creating concise, informative summaries of blog posts.

Please analyze the following blog post and create a summary that captures:
1. The main thesis or key message
2. Important supporting points or arguments
3. Key insights, findings, or conclusions
4. Practical implications or actionable takeaways

Title: ${title}

Content:
${truncatedContent}

Instructions:
- Write a concise summary in 2-4 paragraphs
- Focus on the most important insights and key points
- Use clear, professional language
- Avoid redundancy and filler content
- Capture the essence that would be valuable to someone deciding whether to read the full post

Summary:`;
  }

  private extractTitleFromContent(content: string, url: string): string {
    // Try to extract title from the first few lines of content
    const lines = content.split('\n').slice(0, 10);
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for lines that could be titles (not too short, not too long, first in content)
      if (trimmed.length > 10 && trimmed.length < 200 && !trimmed.includes('  ')) {
        return trimmed;
      }
    }
    
    // Fallback: extract from URL
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart) {
          // Convert URL slug to title
          const title = lastPart
            .replace(/[-_]/g, ' ')
            .replace(/\.(html?|php|aspx?)$/i, '')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          return title;
        }
      }
    } catch (error) {
      this.logger.debug('Failed to extract title from URL', { url, error });
    }
    
    return 'Untitled Post';
  }

  private async saveResult(result: SummaryResult, summaryPath: string): Promise<void> {
    await fs.writeFile(summaryPath, JSON.stringify(result, null, 2));
    this.logger.info('Summary result saved', { summaryPath, url: result.url });
  }

  private formatResponse(result: SummaryResult): string {
    return `# Blog Post Summary

## Original Post
- **Title**: ${result.title}
- **URL**: ${result.url}
- **Summarized**: ${new Date(result.timestamp).toLocaleDateString()}

## Summary

${result.summary}

---

**Note**: This summary has been cached and can be accessed again without re-processing the content.`;
  }
}