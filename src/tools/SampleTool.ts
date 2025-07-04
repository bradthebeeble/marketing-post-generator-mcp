import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { WebScrapingService, BlogPost } from '../services/scraping/WebScrapingService.js';
import { IClaudeService } from '../services/claude/IClaudeService.js';
import { createLogger } from '../utils/logger.js';
import winston from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SampleToolArgs {
  domain: string;
  sampleSize?: number;
  maxRequestsPerSecond?: number;
}

export interface SampleAnalysis {
  positioning: string;
  toneOfVoice: string;
  contentStrategy: string;
  keyThemes: string[];
  writingStyle: string;
  targetAudience: string;
}

export interface SampleResult {
  domain: string;
  sampleSize: number;
  posts: Array<{
    title: string;
    url: string;
    publishedDate?: string;
    author?: string;
    excerpt?: string;
  }>;
  analysis: SampleAnalysis;
  timestamp: string;
}

export class SampleTool {
  private readonly logger: winston.Logger;
  private readonly webScrapingService: WebScrapingService;

  constructor() {
    this.logger = createLogger({ level: 'info', format: 'simple' });
    this.webScrapingService = new WebScrapingService();
  }

  getToolDefinition(): Tool {
    return {
      name: 'sample',
      description:
        "Sample blog posts from a domain to extract positioning, tone of voice, and content strategy. This tool will fetch recent blog posts from the specified domain and analyze them using AI to understand the brand's communication style.",
      inputSchema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description:
              'The domain to sample blog posts from (e.g., "example.com" or "https://blog.example.com")',
          },
          sampleSize: {
            type: 'number',
            description: 'Number of blog posts to sample for analysis (default: 5, max: 20)',
            minimum: 1,
            maximum: 20,
            default: 5,
          },
          maxRequestsPerSecond: {
            type: 'number',
            description: 'Maximum requests per second to respect rate limiting (default: 2)',
            minimum: 0.5,
            maximum: 10,
            default: 2,
          },
        },
        required: ['domain'],
      },
    };
  }

  async execute(args: SampleToolArgs, claudeService: IClaudeService): Promise<string> {
    const { domain, sampleSize = 5, maxRequestsPerSecond = 2 } = args;

    try {
      this.logger.info('Starting sample tool execution', { domain, sampleSize });

      // Validate .postgen directory exists
      await this.validatePostgenDirectory();

      // Fetch blog posts
      this.logger.info('Fetching blog posts', { domain, sampleSize });
      const posts = await this.webScrapingService.sampleBlogPosts(domain, {
        sampleSize,
        maxRequestsPerSecond,
      });

      if (posts.length === 0) {
        throw new Error(
          `No blog posts found for domain: ${domain}. Please verify the domain is accessible and contains blog content.`
        );
      }

      this.logger.info('Blog posts fetched successfully', { domain, postsFound: posts.length });

      // Analyze content with Claude
      this.logger.info('Analyzing content with Claude', { domain, postsCount: posts.length });
      const analysis = await this.analyzeContent(posts, claudeService);

      // Prepare result
      const result: SampleResult = {
        domain,
        sampleSize: posts.length,
        posts: posts.map((post) => ({
          title: post.title,
          url: post.url,
          ...(post.publishedDate && { publishedDate: post.publishedDate }),
          ...(post.author && { author: post.author }),
          ...(post.excerpt && { excerpt: post.excerpt }),
        })),
        analysis,
        timestamp: new Date().toISOString(),
      };

      // Save results
      await this.saveResults(result);

      this.logger.info('Sample tool execution completed successfully', {
        domain,
        postsAnalyzed: posts.length,
      });

      return this.formatResponse(result);
    } catch (error) {
      this.logger.error('Sample tool execution failed', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to sample blog posts from ${domain}: ${error instanceof Error ? error.message : String(error)}`
      );
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

    // Ensure samples directory exists
    const samplesDir = path.join(postgenDir, 'samples');
    try {
      await fs.access(samplesDir);
    } catch (error) {
      await fs.mkdir(samplesDir, { recursive: true });
      this.logger.info('Created samples directory', { samplesDir });
    }
  }

  private async analyzeContent(
    posts: BlogPost[],
    claudeService: IClaudeService
  ): Promise<SampleAnalysis> {
    const analysisPrompt = this.buildAnalysisPrompt(posts);

    const response = await claudeService.generateContent(analysisPrompt, {
      maxTokens: 2048,
      temperature: 0.3,
    });

    return this.parseAnalysisResponse(response.content);
  }

  private buildAnalysisPrompt(posts: BlogPost[]): string {
    const postsContent = posts
      .map(
        (post, index) =>
          `## Post ${index + 1}: ${post.title}\n` +
          `URL: ${post.url}\n` +
          `Author: ${post.author || 'Unknown'}\n` +
          `Published: ${post.publishedDate || 'Unknown'}\n` +
          `Content:\n${post.content.substring(0, 2000)}${post.content.length > 2000 ? '...' : ''}\n\n`
      )
      .join('');

    return `You are a marketing analyst tasked with analyzing blog posts to extract key insights about a brand's communication strategy.

Please analyze the following ${posts.length} blog posts and provide insights in the following JSON format:

{
  "positioning": "Brief description of how the brand positions itself in the market",
  "toneOfVoice": "Description of the brand's tone and communication style",
  "contentStrategy": "Analysis of the content strategy and approach",
  "keyThemes": ["theme1", "theme2", "theme3"],
  "writingStyle": "Description of the writing style and format preferences",
  "targetAudience": "Analysis of who the content is written for"
}

## Blog Posts to Analyze:

${postsContent}

## Analysis Instructions:

1. **Positioning**: Look for how the brand presents itself, what value propositions are emphasized, and how they differentiate from competitors.

2. **Tone of Voice**: Analyze the language style - is it formal/informal, friendly/professional, technical/accessible, authoritative/conversational, etc.

3. **Content Strategy**: Identify patterns in content types, topics covered, content depth, and how they structure their articles.

4. **Key Themes**: Extract the main topics, subjects, or areas of expertise that appear frequently.

5. **Writing Style**: Note formatting preferences, paragraph length, use of examples, technical depth, etc.

6. **Target Audience**: Determine who this content is written for based on language complexity, topics, examples used, etc.

Please respond with ONLY the JSON object, no additional text or formatting.`;
  }

  private parseAnalysisResponse(response: string): SampleAnalysis {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in analysis response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      const requiredFields = [
        'positioning',
        'toneOfVoice',
        'contentStrategy',
        'keyThemes',
        'writingStyle',
        'targetAudience',
      ];
      for (const field of requiredFields) {
        if (!(field in parsed)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      return {
        positioning: parsed.positioning,
        toneOfVoice: parsed.toneOfVoice,
        contentStrategy: parsed.contentStrategy,
        keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes : [],
        writingStyle: parsed.writingStyle,
        targetAudience: parsed.targetAudience,
      };
    } catch (error) {
      this.logger.warn('Failed to parse analysis response as JSON, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback: Create a basic analysis from the raw response
      return {
        positioning: 'Analysis pending - see raw response',
        toneOfVoice: 'Analysis pending - see raw response',
        contentStrategy: 'Analysis pending - see raw response',
        keyThemes: ['content', 'marketing', 'communication'],
        writingStyle: 'Analysis pending - see raw response',
        targetAudience: 'Analysis pending - see raw response',
      };
    }
  }

  private async saveResults(result: SampleResult): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${result.domain.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.json`;
    const filepath = path.join(process.cwd(), '.postgen', 'samples', filename);

    await fs.writeFile(filepath, JSON.stringify(result, null, 2));
    this.logger.info('Sample results saved', { filepath });
  }

  private formatResponse(result: SampleResult): string {
    return `# Blog Sample Analysis for ${result.domain}

## Summary
- **Posts Analyzed**: ${result.sampleSize}
- **Analysis Date**: ${new Date(result.timestamp).toLocaleDateString()}

## Brand Positioning
${result.analysis.positioning}

## Tone of Voice
${result.analysis.toneOfVoice}

## Content Strategy
${result.analysis.contentStrategy}

## Writing Style
${result.analysis.writingStyle}

## Target Audience
${result.analysis.targetAudience}

## Key Themes
${result.analysis.keyThemes.map((theme) => `- ${theme}`).join('\n')}

## Analyzed Posts
${result.posts
  .map(
    (post, index) =>
      `${index + 1}. **${post.title}**\n   - URL: ${post.url}\n   - Author: ${post.author || 'Unknown'}\n   - Published: ${post.publishedDate ? new Date(post.publishedDate).toLocaleDateString() : 'Unknown'}`
  )
  .join('\n\n')}

## Storage
Results have been saved to: \`.postgen/samples/${result.domain.replace(/[^a-zA-Z0-9]/g, '_')}_${result.timestamp.replace(/[:.]/g, '-')}.json\`

This analysis can now be used to inform content creation that matches the brand's established voice and strategy.`;
  }
}
