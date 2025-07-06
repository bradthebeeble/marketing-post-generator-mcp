#!/usr/bin/env node

/**
 * Batch Generation Example - Marketing Post Generator MCP
 * 
 * This example demonstrates efficient batch processing for generating
 * multiple blog posts from a content plan with progress tracking,
 * error handling, and result aggregation.
 * 
 * Features:
 * - Bulk post generation from content plans
 * - Progress tracking with ETA calculations
 * - Intelligent rate limiting and retry logic
 * - Result aggregation and reporting
 * - Resumable operations from checkpoint files
 * 
 * Usage:
 *   node examples/batch-generation.js --domain blog.example.com --count 10
 *   node examples/batch-generation.js --resume checkpoint.json
 *   node examples/batch-generation.js --plan content-plan.json
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEFAULT_CONFIG = {
  domain: 'blog.stripe.com',
  postCount: 5,
  concurrency: 2,
  retryAttempts: 3,
  delayBetweenRequests: 2000,
  checkpointInterval: 5,
  outputDir: './batch-output',
  resumeFromCheckpoint: false
};

class ProgressTracker {
  constructor(total) {
    this.total = total;
    this.completed = 0;
    this.failed = 0;
    this.startTime = performance.now();
    this.lastUpdate = this.startTime;
  }

  update(success = true) {
    if (success) {
      this.completed++;
    } else {
      this.failed++;
    }
    this.display();
  }

  display() {
    const now = performance.now();
    const elapsed = (now - this.startTime) / 1000;
    const processed = this.completed + this.failed;
    const rate = processed / elapsed;
    const eta = rate > 0 ? (this.total - processed) / rate : 0;

    const percentage = ((processed / this.total) * 100).toFixed(1);
    const progressBar = this.createProgressBar(processed, this.total);

    console.log(`\\r${progressBar} ${percentage}% | ${this.completed}✅ ${this.failed}❌ | ETA: ${eta.toFixed(0)}s`);
  }

  createProgressBar(current, total, length = 30) {
    const filled = Math.floor((current / total) * length);
    const bar = '█'.repeat(filled) + '░'.repeat(length - filled);
    return `[${bar}]`;
  }

  getStats() {
    const elapsed = (performance.now() - this.startTime) / 1000;
    return {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      successRate: ((this.completed / this.total) * 100).toFixed(1),
      totalTime: elapsed.toFixed(2),
      averageTime: (elapsed / (this.completed + this.failed)).toFixed(2)
    };
  }
}

class BatchProcessor {
  constructor(config = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mcpProcess = null;
    this.requestId = 1;
    this.activeRequests = new Map();
    this.queue = [];
    this.results = [];
    this.checkpoint = null;
  }

  async initialize() {
    console.log('🚀 Initializing Batch Processor...');
    
    // Create output directory
    await fs.mkdir(this.config.outputDir, { recursive: true });
    
    // Start MCP process
    this.mcpProcess = spawn('node', [join(__dirname, '../dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MCP_MODE: 'local',
        LOG_LEVEL: 'error'
      }
    });

    // Set up response handling
    this.mcpProcess.stdout.on('data', (data) => {
      this.handleMCPResponse(data.toString());
    });

    this.mcpProcess.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('ERROR')) {
        console.error('MCP Error:', message);
      }
    });

    // Wait for MCP to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ MCP Process ready');
  }

  handleMCPResponse(data) {
    const lines = data.trim().split('\\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const response = JSON.parse(line);
        const request = this.activeRequests.get(response.id);
        
        if (request) {
          this.activeRequests.delete(response.id);
          
          if (response.error) {
            request.reject(new Error(response.error.message));
          } else {
            request.resolve(response.result);
          }
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
  }

  async sendMCPRequest(method, params) {
    const id = this.requestId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Store request handler
      this.activeRequests.set(id, { resolve, reject });
      
      // Set timeout
      setTimeout(() => {
        if (this.activeRequests.has(id)) {
          this.activeRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 120000); // 2 minute timeout

      // Send request
      this.mcpProcess.stdin.write(JSON.stringify(request) + '\\n');
    });
  }

  async initializeDomain() {
    console.log(`🏗️  Initializing domain: ${this.config.domain}`);
    
    try {
      await this.sendMCPRequest('prompts/get', {
        name: 'init',
        arguments: { domain: this.config.domain }
      });
      console.log('✅ Domain initialized');
    } catch (error) {
      throw new Error(`Domain initialization failed: ${error.message}`);
    }
  }

  async createContentPlan() {
    console.log(`📋 Creating content plan for ${this.config.postCount} posts...`);
    
    try {
      const result = await this.sendMCPRequest('tools/call', {
        name: 'content_plan',
        arguments: {
          domain: this.config.domain,
          timeframe: 'month',
          postCount: this.config.postCount
        }
      });
      
      console.log(`✅ Content plan created with ${result.plan?.length || 0} posts`);
      return result.plan || [];
    } catch (error) {
      throw new Error(`Content plan creation failed: ${error.message}`);
    }
  }

  async loadCheckpoint() {
    if (!this.config.resumeFromCheckpoint) return null;
    
    try {
      const checkpointPath = this.config.checkpointFile || join(this.config.outputDir, 'checkpoint.json');
      const data = await fs.readFile(checkpointPath, 'utf-8');
      this.checkpoint = JSON.parse(data);
      console.log(`📄 Resumed from checkpoint: ${this.checkpoint.completed}/${this.checkpoint.total} completed`);
      return this.checkpoint;
    } catch (error) {
      console.log('ℹ️  No checkpoint found, starting fresh');
      return null;
    }
  }

  async saveCheckpoint(postPlan, completed, results) {
    const checkpoint = {
      timestamp: new Date().toISOString(),
      domain: this.config.domain,
      total: postPlan.length,
      completed: completed.length,
      remaining: postPlan.filter(p => !completed.includes(p.id)),
      results: results.map(r => ({
        postId: r.postId,
        success: r.success,
        filePath: r.filePath,
        error: r.error
      }))
    };

    const checkpointPath = join(this.config.outputDir, 'checkpoint.json');
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  }

  async generatePost(post, retryCount = 0) {
    const startTime = performance.now();
    
    try {
      // Generate narrative first
      const narrative = await this.sendMCPRequest('tools/call', {
        name: 'generate_narrative',
        arguments: {
          postId: post.id,
          style: 'detailed'
        }
      });

      // Generate blog post
      const blogPost = await this.sendMCPRequest('tools/call', {
        name: 'write_post',
        arguments: {
          narrativeId: post.id,
          wordCount: post.estimatedWordCount || 1200,
          style: 'informative'
        }
      });

      const generationTime = (performance.now() - startTime) / 1000;

      return {
        postId: post.id,
        success: true,
        title: blogPost.title,
        filePath: blogPost.filePath,
        wordCount: blogPost.metadata?.wordCount,
        generationTime: generationTime.toFixed(2),
        narrative: narrative.narrative
      };

    } catch (error) {
      if (retryCount < this.config.retryAttempts) {
        console.log(`⏳ Retrying post ${post.id} (attempt ${retryCount + 1}/${this.config.retryAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return this.generatePost(post, retryCount + 1);
      }

      return {
        postId: post.id,
        success: false,
        title: post.title,
        error: error.message,
        generationTime: (performance.now() - startTime) / 1000
      };
    }
  }

  async processBatch(postPlan) {
    const checkpoint = await this.loadCheckpoint();
    const completed = checkpoint ? checkpoint.results.map(r => r.postId) : [];
    const remaining = postPlan.filter(p => !completed.includes(p.id));
    
    console.log(`\\n📊 Batch Processing Summary:`);
    console.log(`   Total posts: ${postPlan.length}`);
    console.log(`   Already completed: ${completed.length}`);
    console.log(`   Remaining: ${remaining.length}`);
    console.log(`   Concurrency: ${this.config.concurrency}`);
    console.log(`   Delay between requests: ${this.config.delayBetweenRequests}ms\\n`);

    const progress = new ProgressTracker(remaining.length);
    const results = checkpoint ? checkpoint.results : [];
    let processedCount = 0;

    // Process posts with controlled concurrency
    const semaphore = new Array(this.config.concurrency).fill(null);
    const promises = [];

    for (const post of remaining) {
      const promise = this.processWithSemaphore(semaphore, async () => {
        const result = await this.generatePost(post);
        results.push(result);
        progress.update(result.success);
        processedCount++;

        // Save checkpoint periodically
        if (processedCount % this.config.checkpointInterval === 0) {
          await this.saveCheckpoint(postPlan, completed.concat(results.map(r => r.postId)), results);
        }

        // Rate limiting delay
        if (processedCount < remaining.length) {
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenRequests));
        }

        return result;
      });

      promises.push(promise);
    }

    // Wait for all posts to complete
    await Promise.allSettled(promises);

    // Final checkpoint
    await this.saveCheckpoint(postPlan, completed.concat(results.map(r => r.postId)), results);

    console.log('\\n✅ Batch processing completed!');
    return results;
  }

  async processWithSemaphore(semaphore, task) {
    // Wait for available slot
    while (semaphore.every(slot => slot !== null)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Acquire slot
    const slotIndex = semaphore.findIndex(slot => slot === null);
    const promise = task();
    semaphore[slotIndex] = promise;

    try {
      const result = await promise;
      return result;
    } finally {
      // Release slot
      semaphore[slotIndex] = null;
    }
  }

  async generateReport(results, stats) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const report = {
      summary: {
        domain: this.config.domain,
        timestamp: new Date().toISOString(),
        ...stats,
        posts: {
          total: results.length,
          successful: successful.length,
          failed: failed.length
        }
      },
      successful: successful.map(r => ({
        postId: r.postId,
        title: r.title,
        filePath: r.filePath,
        wordCount: r.wordCount,
        generationTime: r.generationTime
      })),
      failed: failed.map(r => ({
        postId: r.postId,
        title: r.title,
        error: r.error,
        generationTime: r.generationTime
      })),
      metrics: {
        averageWordCount: successful.reduce((sum, r) => sum + (r.wordCount || 0), 0) / successful.length || 0,
        averageGenerationTime: results.reduce((sum, r) => sum + parseFloat(r.generationTime), 0) / results.length,
        totalGenerationTime: results.reduce((sum, r) => sum + parseFloat(r.generationTime), 0)
      }
    };

    // Save detailed report
    const reportPath = join(this.config.outputDir, 'batch-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    console.log('\\n📊 Batch Generation Report');
    console.log('==========================');
    console.log(`Domain: ${this.config.domain}`);
    console.log(`Success Rate: ${stats.successRate}%`);
    console.log(`Total Time: ${stats.totalTime}s`);
    console.log(`Average per Post: ${stats.averageTime}s`);
    console.log(`Average Word Count: ${Math.round(report.metrics.averageWordCount)}`);
    console.log(`\\n📄 Detailed report: ${reportPath}`);

    if (failed.length > 0) {
      console.log('\\n❌ Failed Posts:');
      failed.forEach(f => console.log(`   - ${f.title}: ${f.error}`));
    }

    return report;
  }

  async run() {
    try {
      await this.initialize();
      await this.initializeDomain();
      
      const postPlan = await this.createContentPlan();
      if (postPlan.length === 0) {
        throw new Error('No posts in content plan');
      }

      const results = await this.processBatch(postPlan);
      const progressStats = new ProgressTracker(results.length);
      
      // Update progress with final results
      results.forEach(r => progressStats.update(r.success));
      const stats = progressStats.getStats();

      await this.generateReport(results, stats);

    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      throw error;
    } finally {
      if (this.mcpProcess) {
        this.mcpProcess.kill('SIGTERM');
      }
    }
  }

  async cleanup() {
    if (this.mcpProcess) {
      this.mcpProcess.kill('SIGTERM');
      console.log('🛑 MCP process stopped');
    }
  }
}

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--domain':
        config.domain = value;
        break;
      case '--count':
        config.postCount = parseInt(value);
        break;
      case '--concurrency':
        config.concurrency = parseInt(value);
        break;
      case '--output':
        config.outputDir = value;
        break;
      case '--resume':
        config.resumeFromCheckpoint = true;
        config.checkpointFile = value;
        break;
      case '--delay':
        config.delayBetweenRequests = parseInt(value);
        break;
      case '--retries':
        config.retryAttempts = parseInt(value);
        break;
    }
  }

  return config;
}

// Main execution
async function main() {
  console.log('Marketing Post Generator - Batch Processing');
  console.log('==========================================\\n');

  const config = parseArgs();
  console.log('Configuration:');
  console.log(`  Domain: ${config.domain}`);
  console.log(`  Post Count: ${config.postCount}`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log(`  Output Directory: ${config.outputDir}`);
  console.log(`  Resume from Checkpoint: ${config.resumeFromCheckpoint}`);

  const processor = new BatchProcessor(config);

  // Handle graceful shutdown
  const cleanup = async () => {
    console.log('\\n👋 Shutting down gracefully...');
    await processor.cleanup();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    await processor.run();
    console.log('\\n🎉 Batch processing completed successfully!');
  } catch (error) {
    console.error('💥 Batch processing failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default BatchProcessor;