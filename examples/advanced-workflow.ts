#!/usr/bin/env tsx

/**
 * Advanced Workflow Example - Marketing Post Generator MCP
 * 
 * This TypeScript example demonstrates advanced usage patterns:
 * 1. Multiple domain management
 * 2. Batch content generation
 * 3. Custom configurations
 * 4. Error handling and recovery
 * 5. Progress tracking and metrics
 * 6. Content quality scoring
 * 7. Integration with external services
 * 
 * Usage:
 *   tsx examples/advanced-workflow.ts --config config.json
 *   tsx examples/advanced-workflow.ts --domains "blog1.com,blog2.com" --posts 5
 * 
 * Requirements:
 *   npm install tsx
 */

import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { program } from 'commander';
import chalk from 'chalk';

// Type definitions
interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface WorkflowConfig {
  domains: string[];
  postsPerDomain: number;
  sampleSize: number;
  outputDirectory: string;
  parallel: boolean;
  qualityThreshold: number;
  retryAttempts: number;
  webhookUrl?: string;
}

interface GenerationMetrics {
  totalPosts: number;
  successfulPosts: number;
  failedPosts: number;
  averageWordCount: number;
  averageQualityScore: number;
  totalTime: number;
  domainsProcessed: number;
}

interface PostQuality {
  score: number;
  issues: string[];
  suggestions: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class AdvancedMCPClient {
  private process: ChildProcess | null = null;
  private requestId = 1;
  private responseHandlers = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  async start(): Promise<void> {
    console.log(chalk.blue('🚀 Starting Advanced MCP Client...'));
    
    this.process = spawn('node', [join(__dirname, '../dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MCP_MODE: 'local',
        MCP_TRANSPORT: 'stdio',
        LOG_LEVEL: 'error' // Minimal logging for cleaner output
      }
    });

    if (!this.process.stdout || !this.process.stdin || !this.process.stderr) {
      throw new Error('Failed to create MCP process streams');
    }

    // Set up response handling
    this.process.stdout.on('data', (data) => {
      this.handleResponse(data.toString());
    });

    this.process.stderr.on('data', (data) => {
      const message = data.toString();
      if (!message.includes('INFO') && !message.includes('DEBUG')) {
        console.error(chalk.red('MCP Error:'), message);
      }
    });

    this.process.on('error', (error) => {
      console.error(chalk.red('Process Error:'), error);
    });

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(chalk.green('✅ MCP Client started'));
  }

  private handleResponse(data: string): void {
    const lines = data.trim().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const response: MCPResponse = JSON.parse(line);
        const handler = this.responseHandlers.get(response.id);
        
        if (handler) {
          clearTimeout(handler.timeout);
          this.responseHandlers.delete(response.id);
          
          if (response.error) {
            handler.reject(new Error(response.error.message || 'MCP Error'));
          } else {
            handler.resolve(response.result);
          }
        }
      } catch (error) {
        // Ignore malformed JSON (might be partial data)
      }
    }
  }

  async callPrompt(name: string, args: any = {}): Promise<any> {
    return this.sendRequest('prompts/get', { name, arguments: args });
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    const id = this.requestId++;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(id);
        reject(new Error(`Request ${id} timed out`));
      }, 120000); // 2 minute timeout

      // Store handler
      this.responseHandlers.set(id, { resolve, reject, timeout });

      // Send request
      if (this.process?.stdin) {
        this.process.stdin.write(JSON.stringify(request) + '\n');
      } else {
        reject(new Error('MCP process not available'));
      }
    });
  }

  async stop(): Promise<void> {
    // Clear pending requests
    for (const [id, handler] of this.responseHandlers) {
      clearTimeout(handler.timeout);
      handler.reject(new Error('Client shutting down'));
    }
    this.responseHandlers.clear();

    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      console.log(chalk.blue('🛑 MCP Client stopped'));
    }
  }
}

class ContentQualityAnalyzer {
  static analyzePost(content: string, metadata: any): PostQuality {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Word count analysis
    const wordCount = metadata.wordCount || 0;
    if (wordCount < 500) {
      issues.push('Content too short');
      score -= 20;
    } else if (wordCount > 3000) {
      issues.push('Content might be too long');
      score -= 10;
    }

    // Structure analysis
    const headingCount = (content.match(/^#+\s/gm) || []).length;
    if (headingCount < 2) {
      issues.push('Insufficient structure (headings)');
      score -= 15;
    }

    // Keyword analysis
    const keywords = metadata.keywords || [];
    if (keywords.length === 0) {
      issues.push('No keywords specified');
      score -= 10;
    }

    // Reading time analysis
    const readingTime = Math.ceil(wordCount / 200);
    if (readingTime > 15) {
      suggestions.push('Consider breaking into multiple posts');
    }

    // SEO analysis
    if (!content.includes(metadata.title)) {
      suggestions.push('Include title keywords in content');
    }

    return {
      score: Math.max(0, score),
      issues,
      suggestions
    };
  }
}

class AdvancedWorkflow {
  private client: AdvancedMCPClient;
  private config: WorkflowConfig;
  private metrics: GenerationMetrics;
  private startTime: number;

  constructor(config: WorkflowConfig) {
    this.client = new AdvancedMCPClient();
    this.config = config;
    this.metrics = {
      totalPosts: 0,
      successfulPosts: 0,
      failedPosts: 0,
      averageWordCount: 0,
      averageQualityScore: 0,
      totalTime: 0,
      domainsProcessed: 0
    };
    this.startTime = Date.now();
  }

  async run(): Promise<void> {
    try {
      console.log(chalk.cyan('\n🎯 Advanced Content Generation Workflow'));
      console.log(chalk.cyan('==========================================\n'));

      await this.client.start();
      await this.ensureOutputDirectory();

      if (this.config.parallel) {
        await this.runParallel();
      } else {
        await this.runSequential();
      }

      await this.generateReport();
      
    } catch (error) {
      console.error(chalk.red('❌ Workflow failed:'), error);
      throw error;
    } finally {
      await this.client.stop();
    }
  }

  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.outputDirectory, { recursive: true });
      console.log(chalk.green(`📁 Output directory: ${this.config.outputDirectory}`));
    } catch (error) {
      throw new Error(`Failed to create output directory: ${error}`);
    }
  }

  private async runSequential(): Promise<void> {
    console.log(chalk.yellow('🔄 Running sequential workflow...\n'));

    for (const domain of this.config.domains) {
      console.log(chalk.blue(`\n📝 Processing domain: ${domain}`));
      await this.processDomain(domain);
      this.metrics.domainsProcessed++;
    }
  }

  private async runParallel(): Promise<void> {
    console.log(chalk.yellow('⚡ Running parallel workflow...\n'));

    const promises = this.config.domains.map(async (domain) => {
      console.log(chalk.blue(`📝 Starting domain: ${domain}`));
      try {
        await this.processDomain(domain);
        this.metrics.domainsProcessed++;
        console.log(chalk.green(`✅ Completed domain: ${domain}`));
      } catch (error) {
        console.error(chalk.red(`❌ Failed domain: ${domain}`), error);
      }
    });

    await Promise.allSettled(promises);
  }

  private async processDomain(domain: string): Promise<void> {
    const domainStartTime = Date.now();
    
    try {
      // Initialize domain
      await this.initializeDomain(domain);

      // Sample and analyze
      const analysis = await this.analyzeDomain(domain);

      // Create content plan
      const contentPlan = await this.createContentPlan(domain);

      // Generate posts
      await this.generatePosts(domain, contentPlan);

      const domainTime = Date.now() - domainStartTime;
      console.log(chalk.green(`⏱️  Domain ${domain} completed in ${domainTime}ms`));

    } catch (error) {
      console.error(chalk.red(`❌ Domain ${domain} failed:`), error);
      throw error;
    }
  }

  private async initializeDomain(domain: string): Promise<void> {
    try {
      await this.client.callPrompt('init', { domain });
      console.log(chalk.green(`   ✅ Initialized: ${domain}`));
    } catch (error) {
      throw new Error(`Initialization failed for ${domain}: ${error}`);
    }
  }

  private async analyzeDomain(domain: string): Promise<any> {
    const results: any = {};

    try {
      // Sample content with retry logic
      results.sample = await this.withRetry(() => 
        this.client.callTool('sample', {
          domain,
          sampleSize: this.config.sampleSize,
          maxRequestsPerSecond: 1 // Conservative for advanced workflow
        })
      );
      console.log(chalk.green(`   📊 Sampled ${results.sample.posts?.length || 0} posts`));

      // Analyze tone
      results.tone = await this.withRetry(() =>
        this.client.callTool('generate_tone', {
          source: domain,
          detailLevel: 'comprehensive'
        })
      );
      console.log(chalk.green(`   🎯 Tone analysis completed`));

    } catch (error) {
      console.log(chalk.yellow(`   ⚠️  Analysis partially failed: ${error.message}`));
      results.error = error.message;
    }

    return results;
  }

  private async createContentPlan(domain: string): Promise<any> {
    try {
      const contentPlan = await this.withRetry(() =>
        this.client.callTool('content_plan', {
          domain,
          timeframe: 'month',
          postCount: this.config.postsPerDomain,
          updateExisting: false
        })
      );

      console.log(chalk.green(`   📋 Created plan with ${contentPlan.plan?.length || 0} posts`));
      return contentPlan;

    } catch (error) {
      throw new Error(`Content planning failed for ${domain}: ${error}`);
    }
  }

  private async generatePosts(domain: string, contentPlan: any): Promise<void> {
    if (!contentPlan.plan || contentPlan.plan.length === 0) {
      console.log(chalk.yellow(`   ⚠️  No posts to generate for ${domain}`));
      return;
    }

    const posts = contentPlan.plan.slice(0, this.config.postsPerDomain);
    
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      console.log(chalk.blue(`   📝 Generating post ${i + 1}/${posts.length}: ${post.title}`));
      
      try {
        await this.generateSinglePost(domain, post, i + 1);
        this.metrics.successfulPosts++;
      } catch (error) {
        console.error(chalk.red(`   ❌ Failed to generate post: ${error.message}`));
        this.metrics.failedPosts++;
      }
      
      this.metrics.totalPosts++;
    }
  }

  private async generateSinglePost(domain: string, postPlan: any, index: number): Promise<void> {
    try {
      // Generate narrative first
      const narrative = await this.withRetry(() =>
        this.client.callTool('generate_narrative', {
          postId: postPlan.id,
          style: 'detailed'
        })
      );

      // Generate the blog post
      const blogPost = await this.withRetry(() =>
        this.client.callTool('write_post', {
          narrativeId: postPlan.id,
          wordCount: postPlan.estimatedWordCount || 1200,
          style: 'informative'
        })
      );

      // Quality analysis
      const content = await this.readGeneratedPost(blogPost.filePath);
      const quality = ContentQualityAnalyzer.analyzePost(content, blogPost.metadata);

      // Update metrics
      this.updateMetrics(blogPost.metadata, quality);

      // Save enhanced metadata
      await this.saveEnhancedMetadata(domain, index, {
        ...blogPost,
        quality,
        narrative: narrative.narrative
      });

      // Quality check
      if (quality.score < this.config.qualityThreshold) {
        console.log(chalk.yellow(`   ⚠️  Quality score: ${quality.score}% (below threshold)`));
        console.log(chalk.yellow(`     Issues: ${quality.issues.join(', ')}`));
      } else {
        console.log(chalk.green(`   ✅ Quality score: ${quality.score}%`));
      }

      // Webhook notification if configured
      if (this.config.webhookUrl) {
        await this.sendWebhookNotification(domain, blogPost, quality);
      }

    } catch (error) {
      throw new Error(`Post generation failed: ${error.message}`);
    }
  }

  private async readGeneratedPost(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read generated post: ${error}`);
    }
  }

  private updateMetrics(metadata: any, quality: PostQuality): void {
    if (metadata.wordCount) {
      this.metrics.averageWordCount = 
        (this.metrics.averageWordCount * (this.metrics.totalPosts - 1) + metadata.wordCount) / 
        this.metrics.totalPosts;
    }

    this.metrics.averageQualityScore = 
      (this.metrics.averageQualityScore * (this.metrics.totalPosts - 1) + quality.score) / 
      this.metrics.totalPosts;
  }

  private async saveEnhancedMetadata(domain: string, index: number, data: any): Promise<void> {
    const filename = `${domain.replace(/[^a-zA-Z0-9]/g, '-')}-post-${index}-metadata.json`;
    const filepath = join(this.config.outputDirectory, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(chalk.red(`Failed to save metadata: ${error}`));
    }
  }

  private async sendWebhookNotification(domain: string, blogPost: any, quality: PostQuality): Promise<void> {
    try {
      const payload = {
        event: 'post_generated',
        domain,
        post: {
          title: blogPost.title,
          wordCount: blogPost.metadata?.wordCount,
          qualityScore: quality.score,
          filePath: blogPost.filePath
        },
        timestamp: new Date().toISOString()
      };

      // In a real implementation, you would use fetch or axios here
      console.log(chalk.blue(`   🔔 Webhook notification sent for: ${blogPost.title}`));
      
    } catch (error) {
      console.error(chalk.red(`Webhook notification failed: ${error}`));
    }
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.retryAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(chalk.yellow(`   ⏳ Retry ${attempt}/${this.config.retryAttempts} in ${delay}ms...`));
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  private async generateReport(): Promise<void> {
    this.metrics.totalTime = Date.now() - this.startTime;
    
    console.log(chalk.cyan('\n📊 Generation Report'));
    console.log(chalk.cyan('===================\n'));
    
    console.log(chalk.white('📈 Statistics:'));
    console.log(`   Domains processed: ${this.metrics.domainsProcessed}/${this.config.domains.length}`);
    console.log(`   Total posts: ${this.metrics.totalPosts}`);
    console.log(`   Successful: ${chalk.green(this.metrics.successfulPosts)}`);
    console.log(`   Failed: ${chalk.red(this.metrics.failedPosts)}`);
    console.log(`   Success rate: ${((this.metrics.successfulPosts / this.metrics.totalPosts) * 100).toFixed(1)}%`);
    
    console.log(chalk.white('\n📊 Quality Metrics:'));
    console.log(`   Average word count: ${Math.round(this.metrics.averageWordCount)}`);
    console.log(`   Average quality score: ${this.metrics.averageQualityScore.toFixed(1)}%`);
    
    console.log(chalk.white('\n⏱️  Performance:'));
    console.log(`   Total time: ${(this.metrics.totalTime / 1000).toFixed(2)}s`);
    console.log(`   Average per post: ${(this.metrics.totalTime / this.metrics.totalPosts / 1000).toFixed(2)}s`);
    
    // Save detailed report
    const reportPath = join(this.config.outputDirectory, 'generation-report.json');
    await fs.writeFile(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      config: this.config,
      metrics: this.metrics,
      summary: {
        successRate: (this.metrics.successfulPosts / this.metrics.totalPosts) * 100,
        averageTimePerPost: this.metrics.totalTime / this.metrics.totalPosts
      }
    }, null, 2));
    
    console.log(chalk.green(`\n📄 Detailed report saved: ${reportPath}`));
  }
}

// CLI Configuration
program
  .name('advanced-workflow')
  .description('Advanced Marketing Post Generator workflow with TypeScript')
  .version('1.0.0')
  .option('-d, --domains <domains>', 'Comma-separated list of domains', 'blog.stripe.com')
  .option('-p, --posts <number>', 'Posts per domain', '3')
  .option('-s, --sample-size <number>', 'Sample size for analysis', '5')
  .option('-o, --output <directory>', 'Output directory', './output')
  .option('--parallel', 'Run domains in parallel')
  .option('-q, --quality-threshold <number>', 'Quality threshold percentage', '70')
  .option('-r, --retry-attempts <number>', 'Retry attempts for failed operations', '3')
  .option('-w, --webhook <url>', 'Webhook URL for notifications')
  .option('-c, --config <file>', 'Load configuration from JSON file');

program.parse();

const options = program.opts();

// Main execution
async function main(): Promise<void> {
  let config: WorkflowConfig;

  try {
    // Load config from file if specified
    if (options.config) {
      const configData = await fs.readFile(options.config, 'utf-8');
      config = JSON.parse(configData);
    } else {
      // Use command line options
      config = {
        domains: options.domains.split(',').map((d: string) => d.trim()),
        postsPerDomain: parseInt(options.posts),
        sampleSize: parseInt(options.sampleSize),
        outputDirectory: options.output,
        parallel: options.parallel || false,
        qualityThreshold: parseInt(options.qualityThreshold),
        retryAttempts: parseInt(options.retryAttempts),
        webhookUrl: options.webhook
      };
    }

    // Validate configuration
    if (config.domains.length === 0) {
      throw new Error('At least one domain must be specified');
    }

    console.log(chalk.blue('Configuration:'));
    console.log(`  Domains: ${config.domains.join(', ')}`);
    console.log(`  Posts per domain: ${config.postsPerDomain}`);
    console.log(`  Mode: ${config.parallel ? 'Parallel' : 'Sequential'}`);
    console.log(`  Quality threshold: ${config.qualityThreshold}%`);

    const workflow = new AdvancedWorkflow(config);
    await workflow.run();

  } catch (error) {
    console.error(chalk.red('💥 Advanced workflow failed:'), error);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Workflow interrupted by user'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n👋 Workflow terminated'));
  process.exit(0);
});

// Export for use as module
export { AdvancedWorkflow, WorkflowConfig, GenerationMetrics };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}