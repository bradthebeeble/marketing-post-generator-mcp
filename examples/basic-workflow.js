#!/usr/bin/env node

/**
 * Basic Workflow Example - Marketing Post Generator MCP
 * 
 * This example demonstrates a complete end-to-end workflow:
 * 1. Initialize with a blog domain
 * 2. Sample existing content to understand style
 * 3. Analyze tone for consistency
 * 4. Create a content plan
 * 5. Generate a narrative for a post
 * 6. Write a complete blog post
 * 
 * Usage:
 *   node examples/basic-workflow.js [domain]
 * 
 * Example:
 *   node examples/basic-workflow.js blog.stripe.com
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPClient {
  constructor() {
    this.requestId = 1;
    this.process = null;
  }

  async start() {
    console.log('🚀 Starting Marketing Post Generator MCP server...');
    
    // Start the MCP server process
    this.process = spawn('node', [join(__dirname, '../dist/index.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MCP_MODE: 'local',
        MCP_TRANSPORT: 'stdio',
        LOG_LEVEL: 'warn' // Reduce log noise
      }
    });

    // Handle process errors
    this.process.stderr.on('data', (data) => {
      const message = data.toString();
      if (!message.includes('INFO') && !message.includes('DEBUG')) {
        console.error('Server error:', message);
      }
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ MCP server started successfully');
  }

  async callPrompt(name, args = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'prompts/get',
      params: {
        name,
        arguments: args
      }
    };

    return this.sendRequest(request);
  }

  async callTool(name, args = {}) {
    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    };

    return this.sendRequest(request);
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      // Set up response handler
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 60000); // 1 minute timeout

      const responseHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === request.id) {
            clearTimeout(timeout);
            this.process.stdout.removeListener('data', responseHandler);
            
            if (response.error) {
              reject(new Error(response.error.message || 'MCP Error'));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignore parse errors, might be partial data
        }
      };

      this.process.stdout.on('data', responseHandler);

      // Send the request
      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      console.log('🛑 MCP server stopped');
    }
  }
}

class WorkflowDemo {
  constructor(domain = 'blog.stripe.com') {
    this.domain = domain;
    this.client = new MCPClient();
    this.results = {};
  }

  async run() {
    try {
      console.log(`\n🎯 Starting basic workflow demo for: ${this.domain}\n`);

      // Start MCP client
      await this.client.start();

      // Step 1: Initialize
      await this.initialize();

      // Step 2: Sample content
      await this.sampleContent();

      // Step 3: Analyze tone
      await this.analyzeTone();

      // Step 4: Create content plan
      await this.createContentPlan();

      // Step 5: Generate narrative
      await this.generateNarrative();

      // Step 6: Write blog post
      await this.writeBlogPost();

      // Display results summary
      this.displaySummary();

    } catch (error) {
      console.error('❌ Workflow failed:', error.message);
      process.exit(1);
    } finally {
      await this.client.stop();
    }
  }

  async initialize() {
    console.log('1️⃣ Initializing with domain...');
    
    try {
      const result = await this.client.callPrompt('init', {
        domain: this.domain
      });
      
      this.results.init = result;
      console.log('✅ Domain initialized successfully');
      console.log(`   📁 Created .postgen directory structure`);
      
    } catch (error) {
      throw new Error(`Initialization failed: ${error.message}`);
    }
  }

  async sampleContent() {
    console.log('\n2️⃣ Sampling existing content...');
    
    try {
      const result = await this.client.callTool('sample', {
        domain: this.domain,
        sampleSize: 5,
        maxRequestsPerSecond: 2
      });
      
      this.results.sample = result;
      console.log(`✅ Sampled ${result.posts?.length || 0} posts`);
      console.log(`   🎯 Positioning: ${result.analysis?.positioning?.substring(0, 100)}...`);
      console.log(`   🗣️  Tone: ${result.analysis?.toneOfVoice?.substring(0, 100)}...`);
      
    } catch (error) {
      console.log(`⚠️  Sampling failed (continuing anyway): ${error.message}`);
      this.results.sample = { error: error.message };
    }
  }

  async analyzeTone() {
    console.log('\n3️⃣ Analyzing tone of voice...');
    
    try {
      const result = await this.client.callTool('generate_tone', {
        source: this.domain,
        detailLevel: 'detailed'
      });
      
      this.results.tone = result;
      console.log('✅ Tone analysis completed');
      console.log(`   📊 Overall tone: ${result.toneAnalysis?.overallTone || 'N/A'}`);
      console.log(`   👥 Target audience: ${result.toneAnalysis?.targetAudience || 'N/A'}`);
      
    } catch (error) {
      console.log(`⚠️  Tone analysis failed (continuing anyway): ${error.message}`);
      this.results.tone = { error: error.message };
    }
  }

  async createContentPlan() {
    console.log('\n4️⃣ Creating content plan...');
    
    try {
      const result = await this.client.callTool('content_plan', {
        domain: this.domain,
        timeframe: 'month',
        postCount: 4
      });
      
      this.results.contentPlan = result;
      console.log(`✅ Created content plan with ${result.plan?.length || 0} posts`);
      
      if (result.plan?.length > 0) {
        console.log('   📋 Planned posts:');
        result.plan.slice(0, 3).forEach((post, index) => {
          console.log(`      ${index + 1}. ${post.title}`);
        });
        if (result.plan.length > 3) {
          console.log(`      ... and ${result.plan.length - 3} more`);
        }
      }
      
    } catch (error) {
      throw new Error(`Content planning failed: ${error.message}`);
    }
  }

  async generateNarrative() {
    console.log('\n5️⃣ Generating narrative for first post...');
    
    try {
      const firstPost = this.results.contentPlan.plan?.[0];
      if (!firstPost) {
        throw new Error('No posts available in content plan');
      }

      const result = await this.client.callTool('generate_narrative', {
        postId: firstPost.id,
        style: 'detailed'
      });
      
      this.results.narrative = result;
      console.log('✅ Narrative generated');
      console.log(`   📝 Post: ${result.title}`);
      console.log(`   📊 Estimated words: ${result.metadata?.estimatedWordCount || 'N/A'}`);
      console.log(`   ⏱️  Reading time: ${result.metadata?.estimatedReadingTime || 'N/A'}`);
      
    } catch (error) {
      console.log(`⚠️  Narrative generation failed (trying direct post creation): ${error.message}`);
      this.results.narrative = { error: error.message };
    }
  }

  async writeBlogPost() {
    console.log('\n6️⃣ Writing blog post...');
    
    try {
      let result;
      
      // Try to use narrative if available
      if (this.results.narrative && !this.results.narrative.error) {
        result = await this.client.callTool('write_post', {
          narrativeId: this.results.narrative.postId,
          wordCount: 1200,
          style: 'informative'
        });
      } else {
        // Fall back to creating from scratch
        const firstPost = this.results.contentPlan.plan?.[0];
        result = await this.client.callTool('write_post', {
          title: firstPost?.title || 'The Future of Content Generation',
          topic: firstPost?.topic || 'AI and Content Creation',
          keywords: firstPost?.keywords || ['AI', 'content', 'automation'],
          wordCount: 1200,
          style: 'informative'
        });
      }
      
      this.results.blogPost = result;
      console.log('✅ Blog post generated');
      console.log(`   📄 Title: ${result.title}`);
      console.log(`   📝 Word count: ${result.metadata?.wordCount || 'N/A'}`);
      console.log(`   📁 File: ${result.filePath}`);
      
      // Try to read and show excerpt
      try {
        const content = await fs.readFile(result.filePath, 'utf-8');
        const lines = content.split('\n');
        const firstParagraph = lines.find(line => line.trim() && !line.startsWith('#') && !line.includes(':'));
        if (firstParagraph) {
          console.log(`   👀 Excerpt: ${firstParagraph.substring(0, 100)}...`);
        }
      } catch (readError) {
        console.log('   📁 Post saved to file');
      }
      
    } catch (error) {
      throw new Error(`Blog post generation failed: ${error.message}`);
    }
  }

  displaySummary() {
    console.log('\n🎉 Workflow completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Domain: ${this.domain}`);
    console.log(`   Posts sampled: ${this.results.sample?.posts?.length || 'Failed'}`);
    console.log(`   Tone analyzed: ${this.results.tone?.error ? 'Failed' : 'Success'}`);
    console.log(`   Content plan: ${this.results.contentPlan?.plan?.length || 0} posts`);
    console.log(`   Narrative: ${this.results.narrative?.error ? 'Failed' : 'Generated'}`);
    console.log(`   Blog post: ${this.results.blogPost?.title ? 'Generated' : 'Failed'}`);
    
    if (this.results.blogPost?.filePath) {
      console.log('\n📁 Generated files:');
      console.log(`   📝 Blog post: ${this.results.blogPost.filePath}`);
      console.log(`   📋 Content plan: .postgen/content-plans/`);
      console.log(`   📊 Analysis: .postgen/analysis/`);
    }
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Review the generated blog post');
    console.log('   2. Edit and customize as needed');
    console.log('   3. Generate more posts from your content plan');
    console.log('   4. Explore the .postgen directory for all generated content');
  }
}

// Main execution
async function main() {
  const domain = process.argv[2] || 'blog.stripe.com';
  
  console.log('Marketing Post Generator - Basic Workflow Demo');
  console.log('=============================================');
  
  // Validate domain format
  if (!domain.includes('.')) {
    console.error('❌ Please provide a valid domain (e.g., blog.example.com)');
    process.exit(1);
  }
  
  const demo = new WorkflowDemo(domain);
  await demo.run();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Demo interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Demo terminated');
  process.exit(0);
});

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Demo failed:', error.message);
    process.exit(1);
  });
}

export default WorkflowDemo;