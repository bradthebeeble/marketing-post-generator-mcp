import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SearchService } from '../services/search/index.js';
import { IClaudeService } from '../services/claude/IClaudeService.js';
import { createLogger } from '../utils/logger.js';
import winston from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface GenerateToneToolArgs {
  source: string;
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
}

export interface ToneAnalysisResult {
  source: string;
  sourceType: 'url' | 'domain';
  detailLevel: 'basic' | 'detailed' | 'comprehensive';
  toneAnalysis: {
    formality: string;
    emotion: string;
    style: string;
    wordChoicePatterns?: string;
    sentenceStructure?: string;
    uniqueCharacteristics?: string;
    overallTone: string;
  };
  timestamp: string;
}

export class GenerateToneTool {
  private readonly logger: winston.Logger;
  private readonly searchService: SearchService;

  constructor(searchService: SearchService, logger?: winston.Logger) {
    this.logger = logger || createLogger({ level: 'info', format: 'simple' });
    this.searchService = searchService;
  }

  getToolDefinition(): Tool {
    return {
      name: 'generate_tone',
      description:
        'Analyze content to determine the tone of voice used in a blog or specific post. Can analyze either a specific post URL or sample multiple posts from a domain to extract comprehensive tone characteristics.',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description:
              'URL of a specific post or domain name to analyze (e.g., "https://example.com/post" or "example.com")',
          },
          detailLevel: {
            type: 'string',
            description: 'Level of detail in the tone analysis',
            enum: ['basic', 'detailed', 'comprehensive'],
            default: 'detailed',
          },
        },
        required: ['source'],
      },
    };
  }

  async execute(args: GenerateToneToolArgs, claudeService: IClaudeService): Promise<string> {
    const { source, detailLevel = 'detailed' } = args;

    try {
      this.logger.info('Starting tone generation tool execution', { source, detailLevel });

      // Validate .postgen directory exists
      await this.validatePostgenDirectory();

      // Generate source hash for caching
      const sourceHash = this.generateSourceHash(source, detailLevel);
      const tonePath = path.join(process.cwd(), '.postgen', 'analysis', 'tone-analysis', `${sourceHash}.json`);

      // Check for existing tone analysis (cache hit)
      const existingTone = await this.checkExistingTone(tonePath);
      if (existingTone) {
        this.logger.info('Returning cached tone analysis', { source, cached: true });
        return this.formatResponse(existingTone);
      }

      // Determine source type and fetch content
      const { sourceType, content } = await this.determineSourceAndFetchContent(source);

      this.logger.info('Content fetched successfully', {
        source,
        sourceType,
        contentLength: content.length,
      });

      // Generate tone analysis with Claude
      this.logger.info('Generating tone analysis with Claude', { source, detailLevel });
      const toneAnalysis = await this.generateToneAnalysis(content, detailLevel, claudeService);

      // Prepare result
      const result: ToneAnalysisResult = {
        source,
        sourceType,
        detailLevel,
        toneAnalysis,
        timestamp: new Date().toISOString(),
      };

      // Save result
      await this.saveResult(result, tonePath);

      this.logger.info('Tone generation tool execution completed successfully', { source });

      return this.formatResponse(result);
    } catch (error) {
      this.logger.error('Tone generation tool execution failed', {
        source,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to generate tone analysis for ${source}: ${error instanceof Error ? error.message : String(error)}`
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

    // Ensure tone-analysis directory exists
    const toneAnalysisDir = path.join(postgenDir, 'analysis', 'tone-analysis');
    try {
      await fs.access(toneAnalysisDir);
    } catch (error) {
      await fs.mkdir(toneAnalysisDir, { recursive: true });
      this.logger.info('Created tone-analysis directory', { toneAnalysisDir });
    }
  }

  private generateSourceHash(source: string, detailLevel: string): string {
    return crypto.createHash('md5').update(`${source}-${detailLevel}`).digest('hex');
  }

  private async checkExistingTone(tonePath: string): Promise<ToneAnalysisResult | null> {
    try {
      const existingContent = await fs.readFile(tonePath, 'utf-8');
      return JSON.parse(existingContent) as ToneAnalysisResult;
    } catch (error) {
      // No existing tone analysis found
      return null;
    }
  }

  private async determineSourceAndFetchContent(source: string): Promise<{
    sourceType: 'url' | 'domain';
    content: string;
  }> {
    let sourceType: 'url' | 'domain';
    let content: string;

    // Try to determine if source is a URL or domain
    try {
      const url = new URL(source.startsWith('http') ? source : `https://${source}`);
      
      // Check if it's a domain root or has a path
      if (url.pathname === '/' || url.pathname === '') {
        sourceType = 'domain';
        // Get samples from the domain
        this.logger.info('Fetching domain samples for tone analysis', { domain: url.hostname });
        const posts = await this.searchService.sampleDomain(url.hostname, 3);
        
        if (posts.length === 0) {
          throw new Error(
            `No blog posts found for domain: ${url.hostname}. Please verify the domain is accessible and contains blog content.`
          );
        }
        
        content = posts.map(post => `Title: ${post.title}\nContent: ${post.content}`).join('\n\n---\n\n');
      } else {
        sourceType = 'url';
        // Fetch specific post
        this.logger.info('Fetching specific post for tone analysis', { url: source });
        content = await this.searchService.fetchContent(source);
        
        if (!content) {
          throw new Error(
            `Unable to fetch content from URL: ${source}. Please verify the URL is accessible and contains blog content.`
          );
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('No blog posts found')) {
        throw error;
      }
      
      // Assume it's a domain if URL parsing fails
      sourceType = 'domain';
      this.logger.info('Treating as domain and fetching samples', { domain: source });
      const posts = await this.searchService.sampleDomain(source, 3);
      
      if (posts.length === 0) {
        throw new Error(
          `No blog posts found for domain: ${source}. Please verify the domain is accessible and contains blog content.`
        );
      }
      
      content = posts.map(post => `Title: ${post.title}\nContent: ${post.content}`).join('\n\n---\n\n');
    }

    return { sourceType, content };
  }

  private async generateToneAnalysis(
    content: string,
    detailLevel: 'basic' | 'detailed' | 'comprehensive',
    claudeService: IClaudeService
  ): Promise<ToneAnalysisResult['toneAnalysis']> {
    const tonePrompt = this.buildTonePrompt(content, detailLevel);

    const response = await claudeService.generateContent(tonePrompt, {
      maxTokens: detailLevel === 'comprehensive' ? 2048 : detailLevel === 'detailed' ? 1024 : 512,
      temperature: 0.3,
    });

    return this.parseToneResponse(response.content, detailLevel);
  }

  private buildTonePrompt(content: string, detailLevel: 'basic' | 'detailed' | 'comprehensive'): string {
    // Truncate content if too long to fit in prompt
    const maxContentLength = 6000;
    const truncatedContent =
      content.length > maxContentLength ? content.substring(0, maxContentLength) + '...' : content;

    const basePrompt = `You are a professional content analyst specialized in analyzing tone of voice and writing style.

Please analyze the following content and provide a tone analysis in the following JSON format:

{
  "formality": "Description of formality level (formal, informal, conversational, etc.)",
  "emotion": "Description of emotional tone (friendly, professional, enthusiastic, etc.)",
  "style": "Description of writing style (authoritative, accessible, technical, etc.)",
  "overallTone": "Overall tone description combining all aspects"`;

    const detailedFields = `,
  "wordChoicePatterns": "Analysis of word choice patterns and vocabulary preferences",
  "sentenceStructure": "Analysis of sentence structure and paragraph organization"`;

    const comprehensiveFields = `,
  "uniqueCharacteristics": "Unique voice characteristics and distinguishing features"`;

    let promptFields = basePrompt;
    if (detailLevel === 'detailed' || detailLevel === 'comprehensive') {
      promptFields += detailedFields;
    }
    if (detailLevel === 'comprehensive') {
      promptFields += comprehensiveFields;
    }

    promptFields += `
}

## Content to Analyze:

${truncatedContent}

## Analysis Instructions:

1. **Formality**: Assess the level of formality in the writing (formal, semi-formal, informal, conversational)
2. **Emotion**: Identify the emotional tone (friendly, professional, enthusiastic, serious, playful, etc.)
3. **Style**: Analyze the writing style (authoritative, accessible, technical, narrative, instructional, etc.)`;

    if (detailLevel === 'detailed' || detailLevel === 'comprehensive') {
      promptFields += `
4. **Word Choice Patterns**: Examine vocabulary preferences, technical terms usage, and language complexity
5. **Sentence Structure**: Analyze sentence length, complexity, and paragraph organization`;
    }

    if (detailLevel === 'comprehensive') {
      promptFields += `
6. **Unique Characteristics**: Identify distinctive voice elements that make this content unique`;
    }

    promptFields += `

Please respond with ONLY the JSON object, no additional text or formatting.`;

    return promptFields;
  }

  private parseToneResponse(
    response: string,
    detailLevel: 'basic' | 'detailed' | 'comprehensive'
  ): ToneAnalysisResult['toneAnalysis'] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in tone analysis response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      const requiredFields = ['formality', 'emotion', 'style', 'overallTone'];
      for (const field of requiredFields) {
        if (!(field in parsed)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      const result: ToneAnalysisResult['toneAnalysis'] = {
        formality: parsed.formality,
        emotion: parsed.emotion,
        style: parsed.style,
        overallTone: parsed.overallTone,
      };

      // Add optional fields based on detail level
      if (detailLevel === 'detailed' || detailLevel === 'comprehensive') {
        result.wordChoicePatterns = parsed.wordChoicePatterns || 'Not analyzed';
        result.sentenceStructure = parsed.sentenceStructure || 'Not analyzed';
      }

      if (detailLevel === 'comprehensive') {
        result.uniqueCharacteristics = parsed.uniqueCharacteristics || 'Not analyzed';
      }

      return result;
    } catch (error) {
      this.logger.warn('Failed to parse tone analysis response as JSON, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback: Create a basic analysis from the raw response
      const fallbackResult: ToneAnalysisResult['toneAnalysis'] = {
        formality: 'Unable to extract formality analysis from AI response',
        emotion: 'Unable to extract emotion analysis from AI response',
        style: 'Unable to extract style analysis from AI response',
        overallTone: 'Unable to extract overall tone analysis from AI response',
      };

      if (detailLevel === 'detailed' || detailLevel === 'comprehensive') {
        fallbackResult.wordChoicePatterns = 'Unable to extract word choice patterns - manual review recommended';
        fallbackResult.sentenceStructure = 'Unable to extract sentence structure analysis - manual review recommended';
      }

      if (detailLevel === 'comprehensive') {
        fallbackResult.uniqueCharacteristics = 'Unable to extract unique characteristics - manual review recommended';
      }

      return fallbackResult;
    }
  }

  private async saveResult(result: ToneAnalysisResult, tonePath: string): Promise<void> {
    await fs.writeFile(tonePath, JSON.stringify(result, null, 2));
    this.logger.info('Tone analysis result saved', { tonePath, source: result.source });
  }

  private formatResponse(result: ToneAnalysisResult): string {
    const sourceInfo = result.sourceType === 'url' ? 'Specific Post' : 'Domain Sample';
    
    let response = `# Tone of Voice Analysis

## Source Information
- **Type**: ${sourceInfo}
- **Source**: ${result.source}
- **Detail Level**: ${result.detailLevel}
- **Analyzed**: ${new Date(result.timestamp).toLocaleDateString()}

## Tone Analysis

### Formality Level
${result.toneAnalysis.formality}

### Emotional Tone
${result.toneAnalysis.emotion}

### Writing Style
${result.toneAnalysis.style}

### Overall Tone
${result.toneAnalysis.overallTone}`;

    // Add detailed analysis if available
    if (result.toneAnalysis.wordChoicePatterns) {
      response += `

### Word Choice Patterns
${result.toneAnalysis.wordChoicePatterns}`;
    }

    if (result.toneAnalysis.sentenceStructure) {
      response += `

### Sentence Structure
${result.toneAnalysis.sentenceStructure}`;
    }

    if (result.toneAnalysis.uniqueCharacteristics) {
      response += `

### Unique Characteristics
${result.toneAnalysis.uniqueCharacteristics}`;
    }

    const sourceHash = this.generateSourceHash(result.source, result.detailLevel);
    response += `

---

**Note**: This tone analysis has been cached and can be accessed again without re-processing the content.
**Storage**: \`.postgen/analysis/tone-analysis/${sourceHash}.json\`

This analysis can be used to maintain consistent tone across future content creation.`;

    return response;
  }
}