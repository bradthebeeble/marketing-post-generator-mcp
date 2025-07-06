import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SearchService } from '../services/search/index.js';
import { IClaudeService } from '../services/claude/IClaudeService.js';
import { createLogger } from '../utils/logger.js';
import winston from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface BlogPostGeneratorToolArgs {
  narrativeId?: string;
  title?: string;
  topic?: string;
  keywords?: string[];
  wordCount?: number;
  style?: 'informative' | 'persuasive' | 'storytelling' | 'technical' | 'conversational';
  updateExisting?: boolean;
}

export interface BlogPostResult {
  id: string;
  title: string;
  topic: string;
  keywords: string[];
  wordCount: number;
  style: string;
  narrativeId: string | null;
  createdAt: string;
  excerpt: string;
  filePath: string;
  metadataPath: string;
}

export interface NarrativeData {
  postId: string;
  title: string;
  style: string;
  narrative: {
    introduction: string;
    mainSections: { title: string; content: string }[];
    conclusion: string;
    keyPoints: string[];
    callToAction: string;
    wordCount: number;
  };
  rawNarrative: string;
  domain: string;
  toneAnalysis: any;
  createdAt: string;
}

export interface PostgenConfig {
  domain: string;
  initialized: boolean;
  createdAt: string;
}

export class BlogPostGeneratorTool {
  private readonly logger: winston.Logger;

  constructor(_searchService: SearchService, logger?: winston.Logger) {
    this.logger = logger || createLogger({ level: 'info', format: 'simple' });
  }

  getToolDefinition(): Tool {
    return {
      name: 'write_post',
      description:
        'Write a complete blog post from scratch or based on a narrative. Generates full blog posts with configurable style, word count, and optional narrative foundation.',
      inputSchema: {
        type: 'object',
        properties: {
          narrativeId: {
            type: 'string',
            description: 'ID of the narrative to base the post on (optional)',
          },
          title: {
            type: 'string',
            description: 'Title of the blog post (required if narrativeId not provided)',
          },
          topic: {
            type: 'string',
            description: 'Topic of the blog post (required if narrativeId not provided)',
          },
          keywords: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Keywords for the blog post (optional)',
          },
          wordCount: {
            type: 'number',
            description: 'Target word count for the post',
            default: 1000,
            minimum: 500,
            maximum: 5000,
          },
          style: {
            type: 'string',
            description: 'Writing style for the post',
            enum: ['informative', 'persuasive', 'storytelling', 'technical', 'conversational'],
            default: 'informative',
          },
          updateExisting: {
            type: 'boolean',
            description: 'Whether to update an existing post or create a new one',
            default: false,
          },
        },
        required: [],
      },
    };
  }

  async execute(args: BlogPostGeneratorToolArgs, claudeService: IClaudeService): Promise<string> {
    const {
      narrativeId,
      title,
      topic,
      keywords = [],
      wordCount = 1000,
      style = 'informative',
      updateExisting = false,
    } = args;

    try {
      this.logger.info('Starting blog post generation tool execution', {
        narrativeId,
        title,
        topic,
        wordCount,
        style,
        updateExisting,
      });

      // Validate .postgen directory exists
      await this.validatePostgenDirectory();

      // Get configuration
      const config = await this.getPostgenConfig();

      // Determine title and topic
      let finalTitle = title;
      let finalTopic = topic;
      let finalKeywords = keywords;
      let narrative: NarrativeData | null = null;

      // If narrativeId is provided, get the narrative
      if (narrativeId) {
        narrative = await this.getNarrative(narrativeId);
        finalTitle = narrative.title;
        finalTopic = narrative.narrative.keyPoints[0] || topic || 'General topic';
        // Extract keywords from narrative if not provided
        if (keywords.length === 0) {
          finalKeywords = this.extractKeywordsFromNarrative(narrative);
        }
      } else if (!finalTitle || !finalTopic) {
        throw new Error('Either narrativeId or both title and topic must be provided.');
      }

      // Get tone analysis for the domain
      const toneAnalysis = await this.getExistingToneAnalysis(config.domain);

      this.logger.info('Data gathering completed', {
        finalTitle,
        finalTopic,
        keywordCount: finalKeywords.length,
        hasNarrative: !!narrative,
        hasToneAnalysis: !!toneAnalysis,
      });

      // Generate blog post with Claude
      const blogPostContent = await this.generateBlogPost({
        title: finalTitle,
        topic: finalTopic,
        keywords: finalKeywords,
        wordCount,
        style,
        toneAnalysis,
        narrative,
        domain: config.domain,
        claudeService,
      });

      // Save the blog post
      const result = await this.saveBlogPost({
        title: finalTitle,
        topic: finalTopic,
        keywords: finalKeywords,
        wordCount,
        style,
        narrativeId: narrativeId || null,
        content: blogPostContent,
        domain: config.domain,
      });

      this.logger.info('Blog post generation tool execution completed successfully', {
        postId: result.id,
        title: finalTitle,
        actualWordCount: this.estimateWordCount(blogPostContent),
        filePath: result.filePath,
      });

      return this.formatResponse(result);
    } catch (error) {
      this.logger.error('Blog post generation tool execution failed', {
        narrativeId,
        title,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to generate blog post: ${error instanceof Error ? error.message : String(error)}`
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

    // Ensure posts directory exists
    const postsDir = path.join(postgenDir, 'posts');
    try {
      await fs.access(postsDir);
    } catch (error) {
      await fs.mkdir(postsDir, { recursive: true });
      this.logger.info('Created posts directory', { postsDir });
    }
  }

  private async getPostgenConfig(): Promise<PostgenConfig> {
    try {
      const configPath = path.join(process.cwd(), '.postgen', 'config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      throw new Error('Failed to load .postgen configuration. Please run the init tool first.');
    }
  }

  private async getNarrative(narrativeId: string): Promise<NarrativeData> {
    try {
      const narrativesDir = path.join(process.cwd(), '.postgen', 'narratives');
      const files = await fs.readdir(narrativesDir);

      // Find narrative files that match the narrativeId
      const narrativeFiles = files.filter(
        (file) => file.startsWith(`${narrativeId}-`) && file.endsWith('.json')
      );

      if (narrativeFiles.length === 0) {
        throw new Error(
          `No narrative found with ID "${narrativeId}". Available narratives: ${files
            .filter((f) => f.endsWith('.json'))
            .map((f) => f.split('-')[0])
            .join(', ')}`
        );
      }

      // Get the most recent narrative file
      const filesWithStats = await Promise.all(
        narrativeFiles.map(async (file) => {
          const stat = await fs.stat(path.join(narrativesDir, file));
          return { file, mtime: stat.mtime };
        })
      );
      const latestFile = filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];

      if (!latestFile) {
        throw new Error(`No valid narrative files found for ID "${narrativeId}"`);
      }

      const content = await fs.readFile(path.join(narrativesDir, latestFile.file), 'utf-8');
      return JSON.parse(content) as NarrativeData;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No narrative found')) {
        throw error;
      }
      throw new Error(`Failed to load narrative "${narrativeId}": ${error}`);
    }
  }

  private extractKeywordsFromNarrative(narrative: NarrativeData): string[] {
    const keywords = new Set<string>();

    // Extract keywords from title
    narrative.title
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .forEach((word) => keywords.add(word));

    // Extract keywords from key points
    narrative.narrative.keyPoints.forEach((point) => {
      point
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3 && !['this', 'that', 'with', 'from'].includes(word))
        .forEach((word) => keywords.add(word));
    });

    return Array.from(keywords).slice(0, 5); // Limit to 5 keywords
  }

  private async getExistingToneAnalysis(domain: string): Promise<any> {
    try {
      const toneAnalysisDir = path.join(process.cwd(), '.postgen', 'analysis', 'tone-analysis');
      const files = await fs.readdir(toneAnalysisDir);

      // Look for domain-related tone analysis files
      const domainMatcher = this.createDomainMatcher(domain);
      const domainFiles = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(path.join(toneAnalysisDir, file), 'utf-8');
          const toneData = JSON.parse(content);

          if (toneData.source && domainMatcher(file)) {
            domainFiles.push(file);
          }
        } catch {
          // Skip files that can't be read or parsed
        }
      }

      if (domainFiles.length > 0) {
        // Use the most recent tone analysis
        const filesWithStats = await Promise.all(
          domainFiles.map(async (file) => {
            const stat = await fs.stat(path.join(toneAnalysisDir, file));
            return { file, mtime: stat.mtime };
          })
        );
        const latestFile = filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];

        if (latestFile) {
          const content = await fs.readFile(path.join(toneAnalysisDir, latestFile.file), 'utf-8');
          const toneData = JSON.parse(content);

          return {
            formality: toneData.toneAnalysis.formality || 'Not specified',
            emotion: toneData.toneAnalysis.emotion || 'Not specified',
            style: toneData.toneAnalysis.style || 'Not specified',
            overallTone: toneData.toneAnalysis.overallTone || 'Not specified',
            wordChoicePatterns: toneData.toneAnalysis.wordChoicePatterns,
            sentenceStructure: toneData.toneAnalysis.sentenceStructure,
            uniqueCharacteristics: toneData.toneAnalysis.uniqueCharacteristics,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('No existing tone analysis found for domain', { domain, error });
      return null;
    }
  }

  private createDomainMatcher(domain: string): (filename: string) => boolean {
    const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();
    return (filename: string) => {
      const normalizedFile = filename.toLowerCase();
      return (
        (normalizedFile.includes(normalizedDomain.replace(/\./g, '-')) ||
          normalizedFile.includes(normalizedDomain)) &&
        filename.endsWith('.json')
      );
    };
  }

  private async generateBlogPost(options: {
    title: string;
    topic: string;
    keywords: string[];
    wordCount: number;
    style: string;
    toneAnalysis: any;
    narrative: NarrativeData | null;
    domain: string;
    claudeService: IClaudeService;
  }): Promise<string> {
    const prompt = this.buildBlogPostPrompt(options);

    this.logger.info('Generating blog post with Claude', {
      title: options.title,
      style: options.style,
      targetWordCount: options.wordCount,
      promptLength: prompt.length,
    });

    const response = await options.claudeService.generateContent(prompt, {
      maxTokens: Math.min(8192, Math.max(2048, options.wordCount * 2)),
      temperature:
        options.style === 'storytelling' ? 0.7 : options.style === 'conversational' ? 0.6 : 0.5,
    });

    return response.content;
  }

  private buildBlogPostPrompt(options: {
    title: string;
    topic: string;
    keywords: string[];
    wordCount: number;
    style: string;
    toneAnalysis: any;
    narrative: NarrativeData | null;
    domain: string;
  }): string {
    const { title, topic, keywords, wordCount, style, toneAnalysis, narrative, domain } = options;

    // Style-specific guidelines
    const styleGuidelines = {
      informative: {
        approach: 'Provide comprehensive, well-researched information with clear explanations',
        structure: 'Clear introduction, logical sections with headers, conclusion with summary',
        tone: 'Professional, authoritative, educational',
      },
      persuasive: {
        approach: 'Present compelling arguments and evidence to convince readers',
        structure: 'Hook introduction, problem/solution format, strong call-to-action',
        tone: 'Confident, compelling, action-oriented',
      },
      storytelling: {
        approach: 'Use narrative techniques to engage and entertain while informing',
        structure: 'Engaging story arc with character development and resolution',
        tone: 'Engaging, emotional, relatable',
      },
      technical: {
        approach: 'Provide detailed technical information with precise explanations',
        structure: 'Technical overview, step-by-step explanations, implementation details',
        tone: 'Precise, analytical, expert-level',
      },
      conversational: {
        approach: 'Write in a friendly, approachable manner as if talking to a friend',
        structure: 'Casual introduction, flowing sections, personal insights',
        tone: 'Friendly, approachable, personal',
      },
    };

    const guidelines =
      styleGuidelines[style as keyof typeof styleGuidelines] || styleGuidelines.informative;

    let prompt = `You are a professional content writer creating a complete blog post.

## Post Requirements
- **Title**: ${title}
- **Topic**: ${topic}
- **Target Word Count**: ${wordCount} words
- **Writing Style**: ${style}
- **Domain**: ${domain}

## Style Guidelines
- **Approach**: ${guidelines.approach}
- **Structure**: ${guidelines.structure}
- **Tone**: ${guidelines.tone}`;

    // Add keywords if provided
    if (keywords.length > 0) {
      prompt += `
- **Keywords to Include**: ${keywords.join(', ')}`;
    }

    // Add tone analysis if available
    if (toneAnalysis) {
      prompt += `

## Brand Voice Guidelines
Maintain the following tone characteristics throughout the post:
- **Formality Level**: ${toneAnalysis.formality}
- **Emotional Tone**: ${toneAnalysis.emotion}
- **Writing Style**: ${toneAnalysis.style}
- **Overall Tone**: ${toneAnalysis.overallTone}`;

      if (toneAnalysis.wordChoicePatterns) {
        prompt += `
- **Word Choice Patterns**: ${toneAnalysis.wordChoicePatterns}`;
      }

      if (toneAnalysis.sentenceStructure) {
        prompt += `
- **Sentence Structure**: ${toneAnalysis.sentenceStructure}`;
      }
    }

    // Add narrative context if provided
    if (narrative) {
      prompt += `

## Narrative Foundation
Use this narrative structure as the foundation for your blog post:

### Introduction
${narrative.narrative.introduction}

### Main Sections
${narrative.narrative.mainSections
  .map((section, index) => `#### ${index + 1}. ${section.title}\n${section.content}`)
  .join('\n\n')}

### Conclusion
${narrative.narrative.conclusion}

### Key Points to Include
${narrative.narrative.keyPoints.map((point) => `- ${point}`).join('\n')}

### Call to Action
${narrative.narrative.callToAction}`;
    }

    prompt += `

## Content Requirements

Please write a complete blog post that:

1. **Engaging Introduction**: Hook the reader and clearly establish the topic
2. **Well-Structured Body**: Organize content into logical sections with clear headers
3. **Supporting Content**: Include examples, explanations, and relevant details
4. **Natural Keyword Integration**: Incorporate target keywords naturally throughout
5. **Strong Conclusion**: Summarize key points and provide clear next steps
6. **SEO Optimization**: Use headers (H2, H3) and maintain good readability

## Output Format

Please provide the complete blog post in markdown format with:
- Proper heading hierarchy (H1 for title, H2 for main sections, H3 for subsections)
- Well-formatted paragraphs and lists
- Natural keyword integration
- Engaging and readable content

The final post should be approximately ${wordCount} words and perfectly embody the ${style} writing style while maintaining brand consistency.

Generate the complete blog post now:`;

    return prompt;
  }

  private async saveBlogPost(options: {
    title: string;
    topic: string;
    keywords: string[];
    wordCount: number;
    style: string;
    narrativeId: string | null;
    content: string;
    domain: string;
  }): Promise<BlogPostResult> {
    const postId = Date.now().toString();
    const timestamp = new Date().toISOString();
    const postsDir = path.join(process.cwd(), '.postgen', 'posts');

    // Create frontmatter
    const frontmatter = `---
title: ${options.title}
topic: ${options.topic}
keywords: ${options.keywords.join(', ')}
wordCount: ${options.wordCount}
style: ${options.style}
createdAt: ${timestamp}
narrativeId: ${options.narrativeId}
domain: ${options.domain}
---

`;

    // Save markdown file
    const postPath = path.join(postsDir, `${postId}.md`);
    await fs.writeFile(postPath, frontmatter + options.content);

    // Save metadata separately
    const metadata = {
      id: postId,
      title: options.title,
      topic: options.topic,
      keywords: options.keywords,
      wordCount: options.wordCount,
      style: options.style,
      narrativeId: options.narrativeId,
      createdAt: timestamp,
      domain: options.domain,
    };

    const metaPath = path.join(postsDir, `${postId}.json`);
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    // Create excerpt
    const contentWithoutFrontmatter = options.content.replace(/^---[\s\S]*?---\s*/, '');
    const excerpt = contentWithoutFrontmatter.substring(0, 200).replace(/\n/g, ' ').trim() + '...';

    this.logger.info('Blog post saved successfully', {
      postId,
      title: options.title,
      filePath: postPath,
      metadataPath: metaPath,
    });

    return {
      id: postId,
      title: options.title,
      topic: options.topic,
      keywords: options.keywords,
      wordCount: this.estimateWordCount(options.content),
      style: options.style,
      narrativeId: options.narrativeId,
      createdAt: timestamp,
      excerpt,
      filePath: postPath,
      metadataPath: metaPath,
    };
  }

  private estimateWordCount(content: string): number {
    // Remove frontmatter and markdown formatting for accurate count
    const cleanContent = content
      .replace(/^---[\s\S]*?---\s*/, '') // Remove frontmatter
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
      .replace(/`(.+?)`/g, '$1'); // Remove code

    return cleanContent.split(/\s+/).filter((word) => word.length > 0).length;
  }

  private formatResponse(result: BlogPostResult): string {
    const response = `# Blog Post Generated Successfully

## Post Information
- **ID**: ${result.id}
- **Title**: ${result.title}
- **Topic**: ${result.topic}
- **Style**: ${result.style.charAt(0).toUpperCase() + result.style.slice(1)}
- **Word Count**: ${result.wordCount} words
- **Created**: ${new Date(result.createdAt).toLocaleDateString()}
${result.narrativeId ? `- **Based on Narrative**: ${result.narrativeId}` : ''}

## Content Preview
${result.excerpt}

## Keywords Included
${result.keywords.map((keyword) => `- ${keyword}`).join('\n')}

## Files Created
- **Blog Post**: \`${result.filePath}\`
- **Metadata**: \`${result.metadataPath}\`

---

**Success**: Your blog post has been generated and saved successfully!
**Next Steps**: Review the generated content and make any necessary edits before publishing.

The post is stored in the .postgen/posts directory with both markdown content and JSON metadata for easy management and retrieval.`;

    return response;
  }
}
