import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SearchService } from '../services/search/index.js';
import { IClaudeService } from '../services/claude/IClaudeService.js';
import { createLogger } from '../utils/logger.js';
import winston from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface NarrativeGeneratorToolArgs {
  postId: string;
  style?: 'concise' | 'detailed' | 'storytelling';
  updateExisting?: boolean;
}

export interface ContentPlanPost {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  category: string;
  estimatedLength: string;
  priority: 'high' | 'medium' | 'low';
  targetAudience: string;
  contentType: 'educational' | 'promotional' | 'thought-leadership' | 'case-study' | 'tutorial' | 'news' | 'opinion';
}

export interface ContentPlan {
  domain: string;
  timeframe: 'week' | 'month' | 'quarter';
  plan: ContentPlanPost[];
  timestamp: string;
}

export interface ToneAnalysis {
  formality: string;
  emotion: string;
  style: string;
  overallTone: string;
  wordChoicePatterns?: string;
  sentenceStructure?: string;
  uniqueCharacteristics?: string;
}

export interface StructuredNarrative {
  introduction: string;
  mainSections: {
    title: string;
    content: string;
  }[];
  conclusion: string;
  keyPoints: string[];
  callToAction: string;
  wordCount: number;
}

export interface NarrativeResult {
  postId: string;
  title: string;
  style: 'concise' | 'detailed' | 'storytelling';
  narrative: StructuredNarrative;
  rawNarrative: string;
  domain: string;
  toneAnalysis: ToneAnalysis | null;
  createdAt: string;
  sourceContentPlan: string;
}

export class NarrativeGeneratorTool {
  private readonly logger: winston.Logger;

  constructor(_searchService: SearchService, logger?: winston.Logger) {
    this.logger = logger || createLogger({ level: 'info', format: 'simple' });
    // Note: _searchService parameter maintained for consistency with other tools but not currently used
  }

  getToolDefinition(): Tool {
    return {
      name: 'generate_narrative',
      description:
        'Generate detailed narratives and bullet points for upcoming posts based on the content plan. Creates structured content outlines in different styles (concise, detailed, storytelling) that can be used as foundation for blog post writing.',
      inputSchema: {
        type: 'object',
        properties: {
          postId: {
            type: 'string',
            description: 'ID of the post from the content plan to generate narrative for',
          },
          style: {
            type: 'string',
            description: 'Style of the narrative to generate',
            enum: ['concise', 'detailed', 'storytelling'],
            default: 'detailed',
          },
          updateExisting: {
            type: 'boolean',
            description: 'Whether to update an existing narrative or create a new one',
            default: false,
          },
        },
        required: ['postId'],
      },
    };
  }

  async execute(args: NarrativeGeneratorToolArgs, claudeService: IClaudeService): Promise<string> {
    const { postId, style = 'detailed', updateExisting = false } = args;

    try {
      this.logger.info('Starting narrative generation tool execution', { postId, style, updateExisting });

      // Validate .postgen directory exists
      await this.validatePostgenDirectory();

      // Check for existing narrative if not updating
      if (!updateExisting) {
        const existingNarrative = await this.checkExistingNarrative(postId, style);
        if (existingNarrative) {
          this.logger.info('Returning existing narrative', { postId, style, cached: true });
          return this.formatResponse(existingNarrative);
        }
      }

      // Get the latest content plan
      const contentPlan = await this.getLatestContentPlan();
      if (!contentPlan) {
        throw new Error('No content plan found. Please create a content plan first using the content_plan tool.');
      }

      // Find the post in the content plan
      const post = contentPlan.plan.find(p => p.id === postId);
      if (!post) {
        throw new Error(`Post with ID "${postId}" not found in the content plan. Available post IDs: ${contentPlan.plan.map(p => p.id).join(', ')}`);
      }

      // Get tone analysis for the domain
      const toneAnalysis = await this.getExistingToneAnalysis(contentPlan.domain);

      this.logger.info('Data gathering completed', { 
        postId, 
        postTitle: post.title,
        domain: contentPlan.domain,
        hasToneAnalysis: !!toneAnalysis 
      });

      // Generate narrative with Claude
      const narrativeData = await this.generateNarrative({
        post,
        style,
        toneAnalysis,
        domain: contentPlan.domain,
        claudeService,
      });

      // Parse the narrative into structured format
      const structuredNarrative = this.parseNarrative(narrativeData.rawNarrative);

      // Prepare result
      const result: NarrativeResult = {
        postId,
        title: post.title,
        style,
        narrative: structuredNarrative,
        rawNarrative: narrativeData.rawNarrative,
        domain: contentPlan.domain,
        toneAnalysis,
        createdAt: new Date().toISOString(),
        sourceContentPlan: narrativeData.sourceContentPlan,
      };

      // Save the narrative
      const narrativePath = await this.saveNarrative(result);

      this.logger.info('Narrative generation tool execution completed successfully', { 
        postId, 
        style,
        wordCount: structuredNarrative.wordCount,
        narrativePath 
      });

      return this.formatResponse(result);
    } catch (error) {
      this.logger.error('Narrative generation tool execution failed', {
        postId,
        style,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to generate narrative for post "${postId}": ${error instanceof Error ? error.message : String(error)}`
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

    // Ensure narratives directory exists
    const narrativesDir = path.join(postgenDir, 'narratives');
    try {
      await fs.access(narrativesDir);
    } catch (error) {
      await fs.mkdir(narrativesDir, { recursive: true });
      this.logger.info('Created narratives directory', { narrativesDir });
    }
  }

  private async checkExistingNarrative(postId: string, style: string): Promise<NarrativeResult | null> {
    try {
      const narrativesDir = path.join(process.cwd(), '.postgen', 'narratives');
      const files = await fs.readdir(narrativesDir);
      
      // Look for existing narrative files for this post and style
      const narrativeFiles = files.filter(file => 
        file.startsWith(`${postId}-`) && 
        file.includes(`-${style}-`) && 
        file.endsWith('.json')
      );

      if (narrativeFiles.length > 0) {
        // Get the most recent file by modification time
        const filesWithStats = await Promise.all(
          narrativeFiles.map(async (file) => {
            const stat = await fs.stat(path.join(narrativesDir, file));
            return { file, mtime: stat.mtime };
          })
        );
        const latestFile = filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
        
        if (latestFile) {
          const content = await fs.readFile(path.join(narrativesDir, latestFile.file), 'utf-8');
          return JSON.parse(content) as NarrativeResult;
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('Failed to check existing narrative', { postId, style, error });
      return null;
    }
  }

  private async getLatestContentPlan(): Promise<ContentPlan | null> {
    try {
      const contentPlansDir = path.join(process.cwd(), '.postgen', 'content-plans');
      const files = await fs.readdir(contentPlansDir);
      
      // Get the most recent content plan file
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      if (jsonFiles.length > 0) {
        const filesWithStats = await Promise.all(
          jsonFiles.map(async (file) => {
            const stat = await fs.stat(path.join(contentPlansDir, file));
            return { file, mtime: stat.mtime };
          })
        );
        const latestFile = filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
        
        if (latestFile) {
          const content = await fs.readFile(path.join(contentPlansDir, latestFile.file), 'utf-8');
          const contentPlan = JSON.parse(content);
          
          // Transform to expected format if needed
          return {
            domain: contentPlan.domain,
            timeframe: contentPlan.timeframe,
            plan: contentPlan.posts.map((post: any, index: number) => ({
              id: post.id || (index + 1).toString(),
              title: post.title,
              description: post.description,
              keywords: post.keywords || [],
              category: post.category || 'General',
              estimatedLength: post.estimatedLength || 'Medium (800-1500)',
              priority: post.priority || 'medium',
              targetAudience: post.targetAudience || 'General audience',
              contentType: post.contentType || 'educational',
            })),
            timestamp: contentPlan.timestamp,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('Failed to load content plan', { error });
      return null;
    }
  }

  private async getExistingToneAnalysis(domain: string): Promise<ToneAnalysis | null> {
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
      return (normalizedFile.includes(normalizedDomain.replace(/\./g, '-')) || 
              normalizedFile.includes(normalizedDomain)) && 
             filename.endsWith('.json');
    };
  }

  private async generateNarrative(options: {
    post: ContentPlanPost;
    style: 'concise' | 'detailed' | 'storytelling';
    toneAnalysis: ToneAnalysis | null;
    domain: string;
    claudeService: IClaudeService;
  }): Promise<{ rawNarrative: string; sourceContentPlan: string }> {
    const prompt = this.buildNarrativePrompt(options);

    this.logger.info('Generating narrative with Claude', { 
      postId: options.post.id,
      style: options.style,
      promptLength: prompt.length 
    });

    const response = await options.claudeService.generateContent(prompt, {
      maxTokens: options.style === 'storytelling' ? 4096 : options.style === 'detailed' ? 2048 : 1024,
      temperature: options.style === 'storytelling' ? 0.7 : 0.5,
    });

    return {
      rawNarrative: response.content,
      sourceContentPlan: `${options.domain}-${options.post.id}`,
    };
  }

  private buildNarrativePrompt(options: {
    post: ContentPlanPost;
    style: 'concise' | 'detailed' | 'storytelling';
    toneAnalysis: ToneAnalysis | null;
    domain: string;
  }): string {
    const { post, style, toneAnalysis, domain } = options;

    // Style-specific guidelines
    const styleGuidelines = {
      concise: {
        wordCount: '≤500 words',
        approach: 'Create a concise outline with key bullet points and essential information',
        structure: 'Brief introduction, 3-5 main points, conclusion with clear call-to-action',
      },
      detailed: {
        wordCount: '800-1500 words',
        approach: 'Create a comprehensive narrative with detailed sections and supporting information',
        structure: 'Introduction, 4-6 main sections with subsections, detailed conclusion',
      },
      storytelling: {
        wordCount: '1000+ words',
        approach: 'Create an engaging narrative that tells a compelling story around the topic',
        structure: 'Hook introduction, story development with examples and anecdotes, emotional conclusion',
      },
    };

    const guidelines = styleGuidelines[style];

    let prompt = `You are a professional content strategist creating a ${style} narrative for a blog post.

## Post Information
- **Title**: ${post.title}
- **Description**: ${post.description}
- **Keywords**: ${post.keywords.join(', ')}
- **Category**: ${post.category}
- **Target Audience**: ${post.targetAudience}
- **Content Type**: ${post.contentType}
- **Domain**: ${domain}

## Style Requirements
- **Style**: ${style.charAt(0).toUpperCase() + style.slice(1)}
- **Target Length**: ${guidelines.wordCount}
- **Approach**: ${guidelines.approach}
- **Structure**: ${guidelines.structure}`;

    // Add tone analysis if available
    if (toneAnalysis) {
      prompt += `

## Brand Voice Guidelines
Use the following tone characteristics throughout the narrative:
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

    prompt += `

## Narrative Requirements

Please create a structured narrative that includes:

1. **Introduction**: Hook that captures attention and sets context
2. **Main Sections**: ${style === 'concise' ? '3-5' : style === 'detailed' ? '4-6' : '5-8'} key sections with supporting content
3. **Conclusion**: Strong ending that reinforces key messages
4. **Key Points**: Bullet-point summary of main takeaways
5. **Call to Action**: Clear next step for readers

## Response Format

Please respond with a JSON object in the following format:

\`\`\`json
{
  "introduction": "Engaging introduction that hooks the reader...",
  "mainSections": [
    {
      "title": "Section Title",
      "content": "Detailed section content..."
    }
  ],
  "conclusion": "Strong conclusion that reinforces key messages...",
  "keyPoints": [
    "First key takeaway",
    "Second key takeaway"
  ],
  "callToAction": "Clear call-to-action for readers",
  "wordCount": 0,
  "metadata": {
    "tone": "Actual tone used in the narrative",
    "targetKeywords": ["primary", "secondary", "keywords", "used"],
    "emotionalHooks": ["emotional", "elements", "included"]
  }
}
\`\`\`

## Guidelines for ${style.charAt(0).toUpperCase() + style.slice(1)} Style:

${style === 'concise' ? `
- Focus on essential information only
- Use bullet points and short paragraphs
- Prioritize clarity and quick consumption
- Include only the most important supporting details
- Make every word count towards the core message` : 
style === 'detailed' ? `
- Provide comprehensive coverage of the topic
- Include examples, data, and supporting evidence
- Create logical flow between sections
- Address potential questions or objections
- Balance depth with readability` : `
- Create an emotional connection with the reader
- Use anecdotes, examples, and personal stories
- Build narrative tension and resolution
- Include sensory details and vivid descriptions
- Make the content memorable and shareable`}

Generate a narrative that perfectly matches the ${style} style while maintaining the brand voice and achieving the content objectives.`;

    return prompt;
  }

  private parseNarrative(rawNarrative: string): StructuredNarrative {
    try {
      // Extract JSON from response
      const jsonMatch = rawNarrative.match(/```json\s*([\s\S]*?)\s*```/) || rawNarrative.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in narrative response');
      }

      const jsonText = jsonMatch[jsonMatch.length - 1];
      if (!jsonText) {
        throw new Error('No valid JSON content found in response');
      }
      const parsed = JSON.parse(jsonText);

      // Validate and structure the response
      const structuredNarrative: StructuredNarrative = {
        introduction: parsed.introduction || 'Introduction not provided',
        mainSections: Array.isArray(parsed.mainSections) ? parsed.mainSections.map((section: any) => ({
          title: section.title || 'Untitled Section',
          content: section.content || 'Content not provided',
        })) : [],
        conclusion: parsed.conclusion || 'Conclusion not provided',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : ['Key points not provided'],
        callToAction: parsed.callToAction || 'Call to action not provided',
        wordCount: parsed.wordCount || this.estimateWordCount(parsed),
      };

      return structuredNarrative;
    } catch (error) {
      this.logger.error('Failed to parse narrative response', { error });
      
      // Fallback: Create a basic structure from raw response
      const fallbackWordCount = this.estimateWordCount({ content: rawNarrative });
      
      return {
        introduction: 'Narrative parsing failed - raw content available',
        mainSections: [
          {
            title: 'Generated Content',
            content: rawNarrative.slice(0, 1000) + (rawNarrative.length > 1000 ? '...' : ''),
          },
        ],
        conclusion: 'Please review and format the raw narrative content',
        keyPoints: ['Narrative generated but requires manual formatting'],
        callToAction: 'Review the raw narrative content for proper formatting',
        wordCount: fallbackWordCount,
      };
    }
  }

  private estimateWordCount(content: any): number {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private async saveNarrative(result: NarrativeResult): Promise<string> {
    const timestamp = Date.now();
    const cleanPostId = result.postId.replace(/[^a-zA-Z0-9-]/g, '-');
    const narrativePath = path.join(
      process.cwd(), 
      '.postgen', 
      'narratives', 
      `${cleanPostId}-${result.style}-${timestamp}.json`
    );

    await fs.writeFile(narrativePath, JSON.stringify(result, null, 2));
    this.logger.info('Narrative saved', { 
      narrativePath, 
      postId: result.postId, 
      style: result.style,
      wordCount: result.narrative.wordCount 
    });

    return narrativePath;
  }

  private formatResponse(result: NarrativeResult): string {
    const response = `# Narrative for "${result.title}"

## Post Information
- **Post ID**: ${result.postId}
- **Style**: ${result.style.charAt(0).toUpperCase() + result.style.slice(1)}
- **Domain**: ${result.domain}
- **Word Count**: ${result.narrative.wordCount} words
- **Generated**: ${new Date(result.createdAt).toLocaleDateString()}

## Generated Narrative

### Introduction
${result.narrative.introduction}

### Main Content

${result.narrative.mainSections.map((section, index) => `#### ${index + 1}. ${section.title}

${section.content}`).join('\n\n')}

### Conclusion
${result.narrative.conclusion}

## Key Takeaways
${result.narrative.keyPoints.map(point => `- ${point}`).join('\n')}

## Call to Action
${result.narrative.callToAction}

${result.toneAnalysis ? `## Brand Voice Applied
- **Formality**: ${result.toneAnalysis.formality}
- **Emotion**: ${result.toneAnalysis.emotion}
- **Style**: ${result.toneAnalysis.style}
- **Overall Tone**: ${result.toneAnalysis.overallTone}` : ''}

---

**Storage**: This narrative has been saved and can be used as the foundation for writing the complete blog post.
**Next Steps**: Use this narrative with the blog post generator tool to create the final article.

This structured narrative provides a comprehensive ${result.style} outline for "${result.title}" that maintains brand consistency and achieves the content objectives.`;

    return response;
  }
}