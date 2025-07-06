# Claude Code Integration Guide

This guide provides step-by-step instructions for integrating the Marketing Post Generator MCP server with Claude Code.

## Quick Start

1. **Install the Marketing Post Generator MCP server**
   ```bash
   npm install -g marketing-post-generator-mcp
   ```

2. **Configure Claude Code settings**
   ```json
   {
     "mcpServers": {
       "marketing-post-generator": {
         "command": "marketing-post-generator-mcp",
         "env": {
           "CLAUDE_API_KEY": "your_claude_api_key_here"
         }
       }
     }
   }
   ```

3. **Start using in Claude Code**
   ```
   /init domain="blog.example.com"
   /sample domain="blog.example.com"
   /write_post title="My Blog Post" topic="AI" wordCount=1000
   ```

## Complete Integration Process

### Prerequisites

- Claude Code installed and configured
- Node.js 18.0.0 or higher
- Valid Anthropic Claude API key
- Internet connection for web scraping capabilities

### Step 1: Install the MCP Server

#### Option A: Global Installation (Recommended)

```bash
npm install -g marketing-post-generator-mcp
```

#### Option B: Local Project Installation

```bash
# In your project directory
npm install marketing-post-generator-mcp
```

#### Option C: Development Installation

```bash
git clone https://github.com/yourusername/marketing-post-generator-mcp.git
cd marketing-post-generator-mcp
npm install
npm run build
npm link
```

### Step 2: Verify Installation

Test that the server is accessible:

```bash
# Test the server directly
marketing-post-generator-mcp --version

# Or with npx if installed locally
npx marketing-post-generator-mcp --version
```

### Step 3: Configure Claude Code

#### Locate Claude Code Settings

Find your Claude Code settings file:

- **macOS**: `~/Library/Application Support/Claude Code/settings.json`
- **Windows**: `%APPDATA%/Claude Code/settings.json`
- **Linux**: `~/.config/claude-code/settings.json`

#### Add MCP Server Configuration

Add the Marketing Post Generator to your MCP servers configuration:

```json
{
  "mcpServers": {
    "marketing-post-generator": {
      "command": "marketing-post-generator-mcp",
      "args": [],
      "env": {
        "CLAUDE_API_KEY": "your_claude_api_key_here",
        "MCP_MODE": "local",
        "LOG_LEVEL": "info"
      }
    }
  },
  "mcpAllowedTools": [
    "marketing-post-generator:sample",
    "marketing-post-generator:summarize", 
    "marketing-post-generator:generate_tone",
    "marketing-post-generator:content_plan",
    "marketing-post-generator:generate_narrative",
    "marketing-post-generator:write_post"
  ],
  "mcpAllowedPrompts": [
    "marketing-post-generator:init"
  ]
}
```

#### Advanced Configuration Options

For enhanced functionality, add optional configuration:

```json
{
  "mcpServers": {
    "marketing-post-generator": {
      "command": "marketing-post-generator-mcp",
      "args": [],
      "env": {
        "CLAUDE_API_KEY": "your_claude_api_key_here",
        "FIRECRAWL_API_KEY": "your_firecrawl_api_key_here",
        "PERPLEXITY_API_KEY": "your_perplexity_api_key_here",
        "MCP_MODE": "local",
        "LOG_LEVEL": "info",
        "POSTGEN_DATA_DIR": ".postgen",
        "POSTGEN_CACHE_ENABLED": "true",
        "POSTGEN_CACHE_TTL": "3600000"
      }
    }
  }
}
```

### Step 4: Restart Claude Code

After updating the configuration:

1. Quit Claude Code completely
2. Restart Claude Code
3. Verify the MCP server is loaded (check status in Claude Code interface)

### Step 5: Test Integration

#### Basic Test

```
/init domain="blog.stripe.com"
```

Expected response: Confirmation that the generator has been initialized with the domain.

#### Sample Analysis Test

```
/sample domain="blog.stripe.com" sampleSize=3
```

Expected response: Analysis results including positioning, tone of voice, and content strategy.

#### Post Generation Test

```
/write_post title="Getting Started with AI" topic="artificial intelligence" wordCount=800 style="informative"
```

Expected response: Generated blog post with metadata and file path.

## Available Commands

### Initialization Prompt

```
/init domain="your-blog-domain.com"
```

**Purpose**: Set up the .postgen directory structure and configure the generator for your domain.

### Content Analysis Tools

```
# Sample existing content
/sample domain="blog.example.com" sampleSize=5 maxRequestsPerSecond=2

# Analyze tone of voice
/generate_tone source="blog.example.com" detailLevel="detailed"

# Summarize specific posts
/summarize url="https://blog.example.com/specific-post"
```

### Content Planning Tools

```
# Create content plan
/content_plan domain="blog.example.com" timeframe="month" postCount=8

# Generate narrative for planned post
/generate_narrative postId="post-123" style="detailed"
```

### Content Generation Tools

```
# Generate from narrative
/write_post narrativeId="narrative-123" wordCount=1500

# Generate from scratch
/write_post title="My Blog Post" topic="AI Content" keywords=["AI", "content"] wordCount=1200 style="informative"
```

## Workflow Examples

### Complete Content Creation Pipeline

```bash
# 1. Initialize with your domain
/init domain="https://yourblog.com"

# 2. Understand existing content
/sample domain="yourblog.com" sampleSize=5
/generate_tone source="yourblog.com" detailLevel="comprehensive"

# 3. Create strategic plan
/content_plan domain="yourblog.com" timeframe="month" postCount=8

# 4. Generate content
/generate_narrative postId="post-1" style="detailed"
/write_post narrativeId="post-1" wordCount=1500
```

### Quick Post Generation

```bash
# Initialize once per domain
/init domain="techblog.com"

# Generate posts directly
/write_post title="The Future of Web Development" topic="web development trends" keywords=["web", "development", "trends", "2024"] wordCount=1200 style="informative"
```

### Content Analysis Workflow

```bash
# Initialize domain
/init domain="competitor-blog.com"

# Analyze their content strategy
/sample domain="competitor-blog.com" sampleSize=10
/generate_tone source="competitor-blog.com" detailLevel="comprehensive"

# Summarize their best posts
/summarize url="https://competitor-blog.com/popular-post-1"
/summarize url="https://competitor-blog.com/popular-post-2"
```

## Best Practices

### 1. Domain Management

- **Use consistent domain format**: Always use the same format for your domain (e.g., "blog.example.com")
- **Initialize per session**: Run `/init` at the start of each Claude Code session
- **One domain per project**: Keep different clients/domains in separate Claude Code projects

### 2. Content Strategy

- **Sample before planning**: Always analyze existing content before creating new content plans
- **Use tone analysis**: Leverage tone analysis to maintain brand consistency
- **Iterate on narratives**: Create detailed narratives before generating full posts

### 3. Quality Control

- **Review generated content**: Always review and edit AI-generated content
- **Use appropriate word counts**: Match word counts to your typical post length
- **Maintain keyword strategy**: Include relevant keywords for SEO

### 4. File Management

- **Check .postgen directory**: Generated content is saved in the `.postgen` directory
- **Backup important content**: Keep copies of posts you want to preserve
- **Version control**: Consider adding `.postgen/` to `.gitignore` for sensitive content

## Troubleshooting

### Common Issues

#### Server Not Found

**Error**: `MCP server 'marketing-post-generator' not found`

**Solutions**:
1. Verify installation: `npm list -g marketing-post-generator-mcp`
2. Check PATH: `which marketing-post-generator-mcp`
3. Reinstall if necessary: `npm install -g marketing-post-generator-mcp`

#### Authentication Errors

**Error**: `Authentication failed` or `Invalid API key`

**Solutions**:
1. Verify Claude API key in settings
2. Check API key format (should start with `sk-ant-api03-`)
3. Ensure API key has sufficient credits

#### Permission Errors

**Error**: `Cannot create .postgen directory`

**Solutions**:
1. Check write permissions in current directory
2. Run Claude Code with appropriate permissions
3. Change to a directory you own

#### Connection Issues

**Error**: `Domain not accessible` or `Network timeout`

**Solutions**:
1. Check internet connection
2. Verify domain is publicly accessible
3. Try with a different domain
4. Check if domain blocks automated requests

### Debug Mode

Enable debug logging for troubleshooting:

```json
{
  "mcpServers": {
    "marketing-post-generator": {
      "command": "marketing-post-generator-mcp",
      "env": {
        "CLAUDE_API_KEY": "your_api_key",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Getting Help

1. **Check logs**: Look for error messages in Claude Code console
2. **Test manually**: Try running the server directly in terminal
3. **Verify configuration**: Double-check your settings.json
4. **Update software**: Ensure you have the latest versions

## Advanced Configuration

### Custom Data Directory

```json
{
  "env": {
    "POSTGEN_DATA_DIR": "/path/to/custom/directory"
  }
}
```

### Enhanced Web Scraping

```json
{
  "env": {
    "FIRECRAWL_API_KEY": "your_firecrawl_key",
    "CLAUDE_API_KEY": "your_claude_key"
  }
}
```

### Performance Tuning

```json
{
  "env": {
    "CLAUDE_MAX_RETRIES": "5",
    "CLAUDE_TIMEOUT": "60000",
    "CLAUDE_RATE_LIMIT_REQUESTS": "30"
  }
}
```

## Tips for Content Writers

### Getting Started
1. Always initialize with your blog domain first
2. Sample your existing content to understand your voice
3. Create content plans for consistency
4. Generate narratives before full posts for better structure

### Content Quality
- Review and edit all generated content
- Use specific, descriptive titles and topics
- Include relevant keywords for SEO
- Maintain your brand voice and style

### Efficiency
- Create batch content plans for multiple posts
- Use narratives to ensure consistent structure
- Save successful prompts for reuse
- Organize generated content in the .postgen directory

This integration guide should get you up and running with the Marketing Post Generator in Claude Code. For additional help, refer to the main documentation or reach out for support.