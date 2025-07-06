import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SearchService } from '../services/search/index.js';
import { IClaudeService } from '../services/claude/IClaudeService.js';
import { createLogger } from '../utils/logger.js';
import winston from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ContentPlanToolArgs {
  domain: string;
  timeframe?: 'week' | 'month' | 'quarter';
  postCount?: number;
  updateExisting?: boolean;
}

export interface ContentPlanPost {
  title: string;
  description: string;
  keywords: string[];
  category: string;
  estimatedLength: string;
  priority: 'high' | 'medium' | 'low';
  targetAudience: string;
  contentType: 'educational' | 'promotional' | 'thought-leadership' | 'case-study' | 'tutorial' | 'news' | 'opinion';
}

export interface ContentPlanResult {
  domain: string;
  timeframe: 'week' | 'month' | 'quarter';
  postCount: number;
  posts: ContentPlanPost[];
  contentGaps: string[];
  trendingTopics: string[];
  recommendations: string[];
  executionStrategy: string;
  timestamp: string;
  updatedFrom?: string | undefined;
}

export interface ExistingSample {
  title: string;
  content: string;
  url: string;
  categories?: string[];
}

export interface ExistingToneAnalysis {
  formality: string;
  emotion: string;
  style: string;
  overallTone: string;
}

export class ContentPlanTool {
  private readonly logger: winston.Logger;
  // TODO: Future enhancement - integrate SearchService for real-time content research and trend analysis

  constructor(_searchService: SearchService, logger?: winston.Logger) {
    this.logger = logger || createLogger({ level: 'info', format: 'simple' });
    // Note: _searchService parameter maintained for consistency with other tools but not currently used
    // TODO: Future enhancement - integrate SearchService for real-time content research and trend analysis
  }

  getToolDefinition(): Tool {
    return {
      name: 'content_plan',
      description:
        'Create or update a comprehensive content plan for future blog posts. Analyzes existing content, identifies gaps, and generates strategic post recommendations based on domain expertise, content variety, and emerging trends.',
      inputSchema: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'The domain to create a content plan for (e.g., "example.com")',
          },
          timeframe: {
            type: 'string',
            description: 'Timeframe for the content plan',
            enum: ['week', 'month', 'quarter'],
            default: 'month',
          },
          postCount: {
            type: 'number',
            description: 'Number of posts to plan',
            minimum: 1,
            maximum: 50,
            default: 8,
          },
          updateExisting: {
            type: 'boolean',
            description: 'Whether to update an existing plan or create a new one',
            default: false,
          },
        },
        required: ['domain'],
      },
    };
  }

  async execute(args: ContentPlanToolArgs, claudeService: IClaudeService): Promise<string> {
    const { domain, timeframe = 'month', postCount = 8, updateExisting = false } = args;

    try {
      this.logger.info('Starting content plan tool execution', { domain, timeframe, postCount, updateExisting });

      // Validate .postgen directory exists
      await this.validatePostgenDirectory();

      // Gather existing data
      const samples = await this.getExistingSamples(domain);
      const toneAnalysis = await this.getExistingToneAnalysis(domain);
      
      // Check for existing content plan if updating
      let existingPlan: ContentPlanResult | null = null;
      if (updateExisting) {
        existingPlan = await this.getLatestContentPlan(domain);
      }

      this.logger.info('Data gathering completed', { 
        samplesCount: samples.length, 
        hasToneAnalysis: !!toneAnalysis,
        hasExistingPlan: !!existingPlan 
      });

      // Generate content plan with Claude
      const contentPlan = await this.generateContentPlan({
        domain,
        timeframe,
        postCount,
        samples,
        toneAnalysis,
        existingPlan,
        claudeService,
      });

      // Save the content plan
      const planPath = await this.saveContentPlan(contentPlan, domain);

      this.logger.info('Content plan tool execution completed successfully', { 
        domain, 
        postsGenerated: contentPlan.posts.length,
        planPath 
      });

      return this.formatResponse(contentPlan, planPath);
    } catch (error) {
      this.logger.error('Content plan tool execution failed', {
        domain,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to generate content plan for ${domain}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private createDomainMatcher(domain: string): (filename: string) => boolean {
    const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();
    return (filename: string) => {
      const normalizedFile = filename.toLowerCase();
      return (normalizedFile.includes(normalizedDomain.replace(/\./g, '-')) || 
              normalizedFile.includes(normalizedDomain)) && 
             filename.endsWith('.json');
    };
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

    // Ensure content-plans directory exists
    const contentPlansDir = path.join(postgenDir, 'content-plans');
    try {
      await fs.access(contentPlansDir);
    } catch (error) {
      await fs.mkdir(contentPlansDir, { recursive: true });
      this.logger.info('Created content-plans directory', { contentPlansDir });
    }
  }

  private async getExistingSamples(domain: string): Promise<ExistingSample[]> {
    try {
      const samplesDir = path.join(process.cwd(), '.postgen', 'samples');
      
      // Look for domain-specific sample files
      const files = await fs.readdir(samplesDir);
      const domainMatcher = this.createDomainMatcher(domain);
      const domainFiles = files.filter(domainMatcher);

      const samples: ExistingSample[] = [];
      
      for (const file of domainFiles) {
        try {
          const content = await fs.readFile(path.join(samplesDir, file), 'utf-8');
          const sampleData = JSON.parse(content);
          
          // Extract posts from sample data structure
          if (sampleData.posts && Array.isArray(sampleData.posts)) {
            samples.push(...sampleData.posts.map((post: any) => ({
              title: post.title || 'Untitled',
              content: post.content || '',
              url: post.url || '',
              categories: post.categories || [],
            })));
          }
        } catch (error) {
          this.logger.warn('Failed to parse sample file', { file, error });
        }
      }

      this.logger.info('Loaded existing samples', { domain, samplesCount: samples.length });
      return samples;
    } catch (error) {
      this.logger.warn('No existing samples found for domain', { domain });
      return [];
    }
  }

  private async getExistingToneAnalysis(domain: string): Promise<ExistingToneAnalysis | null> {
    try {
      const toneAnalysisDir = path.join(process.cwd(), '.postgen', 'analysis', 'tone-analysis');
      const files = await fs.readdir(toneAnalysisDir);
      
      // Look for domain-related tone analysis files
      const domainFiles = [];
      for (const file of files) {
        try {
          const content = await fs.readFile(path.join(toneAnalysisDir, file), 'utf-8');
          const toneData = JSON.parse(content);
          // Use more specific domain matching to prevent false positives
          if (toneData.source && this.createDomainMatcher(domain)(file)) {
            domainFiles.push(file);
          }
        } catch {
          // Skip files that can't be read or parsed
        }
      }

      if (domainFiles.length > 0) {
        // Use the most recent tone analysis by modification time
        const filesWithStats = await Promise.all(
          domainFiles.map(async (file) => {
            const stat = await fs.stat(path.join(toneAnalysisDir, file));
            return { file, mtime: stat.mtime };
          })
        );
        const latestFile = filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
        if (!latestFile) {
          return null;
        }
        const content = await fs.readFile(path.join(toneAnalysisDir, latestFile.file), 'utf-8');
        const toneData = JSON.parse(content);
        
        return {
          formality: toneData.toneAnalysis.formality || 'Not specified',
          emotion: toneData.toneAnalysis.emotion || 'Not specified',
          style: toneData.toneAnalysis.style || 'Not specified',
          overallTone: toneData.toneAnalysis.overallTone || 'Not specified',
        };
      }

      return null;
    } catch (error) {
      this.logger.warn('No existing tone analysis found for domain', { domain });
      return null;
    }
  }

  private async getLatestContentPlan(domain: string): Promise<ContentPlanResult | null> {
    try {
      const contentPlansDir = path.join(process.cwd(), '.postgen', 'content-plans');
      const files = await fs.readdir(contentPlansDir);
      
      // Look for domain-specific content plan files
      const domainMatcher = this.createDomainMatcher(domain);
      const domainFiles = files.filter(domainMatcher);

      if (domainFiles.length > 0) {
        // Get the most recent file by modification time
        const filesWithStats = await Promise.all(
          domainFiles.map(async (file) => {
            const stat = await fs.stat(path.join(contentPlansDir, file));
            return { file, mtime: stat.mtime };
          })
        );
        const latestFile = filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
        if (!latestFile) {
          return null;
        }
        const content = await fs.readFile(path.join(contentPlansDir, latestFile.file), 'utf-8');
        return JSON.parse(content) as ContentPlanResult;
      }

      return null;
    } catch (error) {
      this.logger.warn('No existing content plan found for domain', { domain });
      return null;
    }
  }

  private async generateContentPlan(options: {
    domain: string;
    timeframe: 'week' | 'month' | 'quarter';
    postCount: number;
    samples: ExistingSample[];
    toneAnalysis: ExistingToneAnalysis | null;
    existingPlan: ContentPlanResult | null;
    claudeService: IClaudeService;
  }): Promise<ContentPlanResult> {
    const prompt = this.buildContentPlanPrompt(options);

    this.logger.info('Generating content plan with Claude', { 
      domain: options.domain, 
      promptLength: prompt.length 
    });

    const response = await options.claudeService.generateContent(prompt, {
      maxTokens: 4096,
      temperature: 0.4,
    });

    const parsedPlan = this.parseContentPlanResponse(response.content, options);

    return {
      domain: options.domain,
      timeframe: options.timeframe,
      postCount: options.postCount,
      posts: parsedPlan.posts,
      contentGaps: parsedPlan.contentGaps,
      trendingTopics: parsedPlan.trendingTopics,
      recommendations: parsedPlan.recommendations,
      executionStrategy: parsedPlan.executionStrategy,
      timestamp: new Date().toISOString(),
      updatedFrom: options.existingPlan?.timestamp || undefined,
    };
  }

  private buildContentPlanPrompt(options: {
    domain: string;
    timeframe: 'week' | 'month' | 'quarter';
    postCount: number;
    samples: ExistingSample[];
    toneAnalysis: ExistingToneAnalysis | null;
    existingPlan: ContentPlanResult | null;
  }): string {
    const { domain, timeframe, postCount, samples, toneAnalysis, existingPlan } = options;

    let prompt = `You are a professional content strategist tasked with creating a comprehensive content plan for "${domain}".

## Context Information

**Target**: ${postCount} blog posts over ${timeframe === 'week' ? '1 week' : timeframe === 'month' ? '1 month' : '3 months'}
**Domain**: ${domain}`;

    // Add existing content context
    if (samples.length > 0) {
      prompt += `

## Existing Content Analysis

The domain currently has ${samples.length} analyzed posts with the following themes:
${samples.slice(0, 5).map(sample => `- "${sample.title}": ${sample.content.slice(0, 100)}...`).join('\n')}`;
    }

    // Add tone analysis if available
    if (toneAnalysis) {
      prompt += `

## Brand Voice Guidelines

Based on existing content analysis:
- **Formality**: ${toneAnalysis.formality}
- **Emotion**: ${toneAnalysis.emotion}
- **Style**: ${toneAnalysis.style}
- **Overall Tone**: ${toneAnalysis.overallTone}`;
    }

    // Add existing plan context if updating
    if (existingPlan) {
      prompt += `

## Previous Plan Context

This is an update to an existing content plan from ${new Date(existingPlan.timestamp).toLocaleDateString()}.
Previous plan included ${existingPlan.posts.length} posts covering these topics:
${existingPlan.posts.slice(0, 3).map(post => `- ${post.title} (${post.category})`).join('\n')}

Please consider these previous plans while creating new content that builds upon or complements the existing strategy.`;
    }

    prompt += `

## Content Plan Requirements

Please create a comprehensive content plan that includes:

1. **Content Gap Analysis**: Identify missing topics or content types
2. **Trending Topics**: Suggest current industry trends to cover
3. **Strategic Recommendations**: Overall content strategy advice
4. **Execution Strategy**: How to implement this content plan effectively

## Response Format

Please respond with a JSON object in the following format:

\`\`\`json
{
  "posts": [
    {
      "title": "Specific post title",
      "description": "Detailed description of the post content and approach",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "category": "Category name",
      "estimatedLength": "Short (500-800) | Medium (800-1500) | Long (1500+)",
      "priority": "high | medium | low",
      "targetAudience": "Description of target audience",
      "contentType": "educational | promotional | thought-leadership | case-study | tutorial | news | opinion"
    }
  ],
  "contentGaps": [
    "Description of content gaps identified"
  ],
  "trendingTopics": [
    "Current trending topics relevant to the domain"
  ],
  "recommendations": [
    "Strategic recommendations for content success"
  ],
  "executionStrategy": "Detailed strategy for implementing this content plan"
}
\`\`\`

## Guidelines

1. **Variety**: Include diverse content types and formats
2. **Value**: Focus on providing genuine value to readers
3. **SEO**: Consider search optimization potential
4. **Engagement**: Plan content that encourages interaction
5. **Brand Consistency**: Maintain the established tone and style
6. **Seasonal Relevance**: Consider timing and seasonal factors
7. **Competitive Edge**: Suggest unique angles or perspectives

Generate exactly ${postCount} post ideas that form a cohesive content strategy.`;

    return prompt;
  }

  private parseContentPlanResponse(response: string, options: {
    domain: string;
    timeframe: 'week' | 'month' | 'quarter';
    postCount: number;
  }): {
    posts: ContentPlanPost[];
    contentGaps: string[];
    trendingTopics: string[];
    recommendations: string[];
    executionStrategy: string;
  } {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in content plan response');
      }

      const jsonText = jsonMatch[jsonMatch.length - 1];
      if (!jsonText) {
        throw new Error('No valid JSON content found in response');
      }
      const parsed = JSON.parse(jsonText);

      // Validate and structure the response
      const posts: ContentPlanPost[] = (parsed.posts || []).map((post: any) => ({
        title: post.title || 'Untitled Post',
        description: post.description || 'No description provided',
        keywords: Array.isArray(post.keywords) ? post.keywords : [],
        category: post.category || 'General',
        estimatedLength: post.estimatedLength || 'Medium (800-1500)',
        priority: ['high', 'medium', 'low'].includes(post.priority) ? post.priority : 'medium',
        targetAudience: post.targetAudience || 'General audience',
        contentType: [
          'educational', 'promotional', 'thought-leadership', 'case-study', 
          'tutorial', 'news', 'opinion'
        ].includes(post.contentType) ? post.contentType : 'educational',
      }));

      return {
        posts: posts.slice(0, options.postCount), // Ensure we don't exceed requested count
        contentGaps: Array.isArray(parsed.contentGaps) ? parsed.contentGaps : [],
        trendingTopics: Array.isArray(parsed.trendingTopics) ? parsed.trendingTopics : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        executionStrategy: parsed.executionStrategy || 'No execution strategy provided',
      };
    } catch (error) {
      this.logger.error('Failed to parse content plan response', { error });
      
      // Fallback: Create a basic plan
      return {
        posts: Array.from({ length: options.postCount }, (_, i) => ({
          title: `Content Idea ${i + 1} for ${options.domain}`,
          description: 'Content plan generation failed - manual planning required',
          keywords: [options.domain.replace(/\./g, '')],
          category: 'General',
          estimatedLength: 'Medium (800-1500)',
          priority: 'medium' as const,
          targetAudience: 'General audience',
          contentType: 'educational' as const,
        })),
        contentGaps: ['Unable to analyze content gaps - manual review required'],
        trendingTopics: ['Unable to identify trending topics - manual research required'],
        recommendations: ['Content plan generation failed - please review and create manually'],
        executionStrategy: 'Manual planning required due to generation failure',
      };
    }
  }

  private async saveContentPlan(contentPlan: ContentPlanResult, domain: string): Promise<string> {
    const timestamp = Date.now();
    const cleanDomain = domain.replace(/\./g, '-');
    const planPath = path.join(
      process.cwd(), 
      '.postgen', 
      'content-plans', 
      `${cleanDomain}-${contentPlan.timeframe}-${timestamp}.json`
    );

    await fs.writeFile(planPath, JSON.stringify(contentPlan, null, 2));
    this.logger.info('Content plan saved', { planPath, domain, postsCount: contentPlan.posts.length });

    return planPath;
  }

  private formatResponse(contentPlan: ContentPlanResult, planPath: string): string {
    const response = `# Content Plan for ${contentPlan.domain}

## Plan Overview
- **Timeframe**: ${contentPlan.timeframe}
- **Posts Planned**: ${contentPlan.posts.length}
- **Created**: ${new Date(contentPlan.timestamp).toLocaleDateString()}
${contentPlan.updatedFrom ? `- **Updated From**: ${new Date(contentPlan.updatedFrom).toLocaleDateString()}` : ''}

## Planned Content

${contentPlan.posts.map((post, index) => `### ${index + 1}. ${post.title}

**Category**: ${post.category} | **Priority**: ${post.priority} | **Type**: ${post.contentType}
**Length**: ${post.estimatedLength}
**Target Audience**: ${post.targetAudience}

${post.description}

**Keywords**: ${post.keywords.join(', ')}

---`).join('\n\n')}

## Content Strategy Analysis

### Identified Content Gaps
${contentPlan.contentGaps.map(gap => `- ${gap}`).join('\n')}

### Trending Topics to Consider
${contentPlan.trendingTopics.map(topic => `- ${topic}`).join('\n')}

### Strategic Recommendations
${contentPlan.recommendations.map(rec => `- ${rec}`).join('\n')}

## Execution Strategy

${contentPlan.executionStrategy}

---

**Content Plan Storage**: \`${planPath.split('/').slice(-3).join('/')}\`

This comprehensive content plan provides a strategic roadmap for creating engaging, valuable content that aligns with your brand voice and audience needs. Each post idea includes specific guidance for implementation and optimization.`;

    return response;
  }
}