# Marketing Post Generator MCP Server

[![npm version](https://badge.fury.io/js/marketing-post-generator-mcp.svg)](https://badge.fury.io/js/marketing-post-generator-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

A powerful Model Context Protocol (MCP) server that provides AI-powered content generation tools for marketing blog posts. This server integrates seamlessly with MCP clients like Claude Code to automate content creation workflows.

## 🚀 Quick Start as MCP Server

### Option 1: Using npx (Recommended - No Installation Required)

Configure your MCP client to use npx for automatic package management:

#### Claude Code Configuration with npx

Edit your Claude Code settings file (`~/.config/claude-code/settings.json` or equivalent):

```json
{
  "mcpServers": {
    "marketing-post-generator": {
      "command": "npx",
      "args": ["marketing-post-generator-mcp"],
      "env": {
        "CLAUDE_API_KEY": "your_claude_api_key_here",
        "MCP_MODE": "local"
      }
    }
  }
}
```

#### Generic MCP Client Configuration with npx

```json
{
  "servers": {
    "marketing-post-generator": {
      "command": ["npx", "marketing-post-generator-mcp"],
      "env": {
        "CLAUDE_API_KEY": "your_claude_api_key_here"
      }
    }
  }
}
```

**Benefits of npx approach:**
- ✨ No global installation needed
- 🔄 Always uses the latest version
- 🎯 Version pinning available (`npx marketing-post-generator-mcp@1.0.0`)
- 🧹 Keeps your system clean

### Option 2: Traditional Installation

#### Step 1: Install the Server

```bash
# Global installation (for persistent usage)
npm install -g marketing-post-generator-mcp

# Or local installation
npm install marketing-post-generator-mcp
```

#### Step 2: Configure Your MCP Client

#### Claude Code Configuration

Edit your Claude Code settings file (`~/.config/claude-code/settings.json` or equivalent):

```json
{
  "mcpServers": {
    "marketing-post-generator": {
      "command": "marketing-post-generator-mcp",
      "env": {
        "CLAUDE_API_KEY": "your_claude_api_key_here",
        "MCP_MODE": "local"
      }
    }
  }
}
```

#### Generic MCP Client Configuration

```json
{
  "servers": {
    "marketing-post-generator": {
      "command": ["marketing-post-generator-mcp"],
      "env": {
        "CLAUDE_API_KEY": "your_claude_api_key_here"
      }
    }
  }
}
```

### Step 3: Start Using MCP Tools

Once configured, you can use the following MCP tools and prompts:

```bash
# Initialize with your blog domain
/init domain="blog.example.com"

# Sample existing content
/sample domain="blog.example.com" sampleSize=5

# Create content plan
/content_plan domain="blog.example.com" timeframe="month" postCount=8

# Generate blog posts
/write_post title="My Blog Post" topic="AI" wordCount=1000
```

## ✨ Features

- 🔍 **Content Sampling**: Analyze existing blog posts from any domain to extract positioning, tone, and content strategy
- 📝 **Post Summarization**: Generate concise summaries of individual blog posts
- 🎯 **Tone Analysis**: Determine the tone of voice used in blogs or specific posts
- 📋 **Content Planning**: Create strategic content plans for future posts based on domain expertise and trends
- 📖 **Narrative Generation**: Create detailed narratives and bullet points for upcoming posts
- ✍️ **Blog Post Generation**: Write complete blog posts from scratch or based on narratives
- 🔄 **MCP Protocol**: Full Model Context Protocol compliance for seamless integration
- 🛡️ **Security**: Built-in rate limiting and error handling
- 🐳 **Docker Support**: Containerized deployment for easy scaling

## 🛠️ MCP Server Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLAUDE_API_KEY` | ✅ | - | Anthropic Claude API key |
| `MCP_MODE` | ❌ | `local` | Server mode: `local` or `remote` |
| `MCP_TRANSPORT` | ❌ | `stdio` | Transport: `stdio` or `http` |
| `MCP_PORT` | ❌ | `3000` | Port for HTTP mode |
| `FIRECRAWL_API_KEY` | ❌ | - | Enhanced web scraping |
| `PERPLEXITY_API_KEY` | ❌ | - | Research capabilities |
| `LOG_LEVEL` | ❌ | `info` | Logging level |

### Advanced Configuration

```json
{
  "mcpServers": {
    "marketing-post-generator": {
      "command": "marketing-post-generator-mcp",
      "env": {
        "CLAUDE_API_KEY": "your_claude_api_key",
        "FIRECRAWL_API_KEY": "your_firecrawl_key",
        "PERPLEXITY_API_KEY": "your_perplexity_key",
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

## 📋 Available MCP Tools

### 1. **sample** - Content Analysis
Analyze existing blog posts from a domain to understand positioning and tone.

**Parameters:**
- `domain` (required): Domain to analyze (e.g., "blog.stripe.com")
- `sampleSize` (optional): Number of posts to sample (default: 5, max: 20)
- `maxRequestsPerSecond` (optional): Rate limiting (default: 2)

**Example:**
```bash
/sample domain="blog.stripe.com" sampleSize=5
```

### 2. **summarize** - Post Summarization
Generate concise summaries of individual blog posts.

**Parameters:**
- `url` (required): URL of the blog post to summarize

**Example:**
```bash
/summarize url="https://blog.stripe.com/online-payments-guide"
```

### 3. **generate_tone** - Tone Analysis
Analyze the tone of voice used in content.

**Parameters:**
- `source` (required): URL or domain to analyze
- `detailLevel` (optional): Analysis depth - "basic", "detailed", "comprehensive" (default: "detailed")

**Example:**
```bash
/generate_tone source="blog.stripe.com" detailLevel="comprehensive"
```

### 4. **content_plan** - Strategic Planning
Create comprehensive content plans for future posts.

**Parameters:**
- `domain` (required): Domain to create plan for
- `timeframe` (optional): Planning period - "week", "month", "quarter" (default: "month")
- `postCount` (optional): Number of posts to plan (default: 8)
- `updateExisting` (optional): Update existing plan (default: false)

**Example:**
```bash
/content_plan domain="blog.stripe.com" timeframe="month" postCount=12
```

### 5. **generate_narrative** - Content Outlines
Generate detailed narratives and outlines for posts.

**Parameters:**
- `postId` (required): ID from content plan
- `style` (optional): Narrative style - "concise", "detailed", "storytelling" (default: "detailed")
- `updateExisting` (optional): Update existing narrative (default: false)

**Example:**
```bash
/generate_narrative postId="post-1" style="detailed"
```

### 6. **write_post** - Blog Post Generation
Generate complete blog posts from scratch or narratives.

**Parameters:**
- `narrativeId` (optional): Base on existing narrative
- `title` (optional): Post title (required if no narrativeId)
- `topic` (optional): Post topic (required if no narrativeId)
- `keywords` (optional): Target keywords array
- `wordCount` (optional): Target word count (default: 1000)
- `style` (optional): Writing style - "informative", "persuasive", "storytelling", "technical", "conversational" (default: "informative")
- `updateExisting` (optional): Update existing post (default: false)

**Examples:**
```bash
# From narrative
/write_post narrativeId="narrative-1" wordCount=1500

# From scratch
/write_post title="Getting Started with AI" topic="artificial intelligence" keywords=["AI", "machine learning"] wordCount=1200 style="informative"
```

## 🎯 Available MCP Prompts

### **init** - Domain Initialization
Initialize the generator with a blog domain and set up the workspace.

**Parameters:**
- `domain` (required): Blog domain or URL (e.g., "blog.example.com" or "https://blog.example.com")

**Example:**
```bash
/init domain="blog.stripe.com"
```

**What it does:**
- Creates `.postgen/` directory structure
- Validates domain accessibility
- Sets up configuration files
- Prepares for content analysis and generation

## 🔄 Complete MCP Workflows

### End-to-End Content Creation
```bash
# 1. Initialize
/init domain="yourblog.com"

# 2. Analyze existing content
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
/write_post title="The Future of Web Development" topic="web development trends" keywords=["web", "development", "2024"] wordCount=1200
```

### Competitor Analysis
```bash
# Analyze competitor content
/init domain="competitor-blog.com"
/sample domain="competitor-blog.com" sampleSize=10
/generate_tone source="competitor-blog.com" detailLevel="comprehensive"

# Summarize their best posts
/summarize url="https://competitor-blog.com/popular-post"
```

## 🏗️ MCP Server Architecture

### Transport Modes

#### Local Mode (stdio) - Default
- **Use case**: Direct MCP client integration (Claude Code, etc.)
- **Transport**: Standard input/output
- **Configuration**: `MCP_MODE=local`
- **Best for**: Desktop applications, CLI tools

#### Remote Mode (HTTP)
- **Use case**: Web applications, API integrations
- **Transport**: HTTP with JSON-RPC 2.0
- **Configuration**: `MCP_MODE=remote MCP_PORT=3000`
- **Best for**: Web services, multiple concurrent users

### Data Storage

The server creates a `.postgen/` directory structure:

```
.postgen/
├── config.json              # Domain configuration
├── analysis/
│   ├── samples/              # Domain analysis results
│   ├── tone-analysis/        # Tone analysis cache
│   └── summaries/            # Post summaries
├── content-plans/            # Strategic content plans
├── narratives/              # Generated outlines
└── posts/                   # Generated blog posts
    ├── drafts/              # Work in progress
    └── published/           # Final posts
```

## 🔧 MCP Client Integration Examples

### Python MCP Client

```python
import json
import subprocess
from typing import Dict, Any

class MarketingPostGeneratorMCP:
    def __init__(self, api_key: str):
        self.process = subprocess.Popen(
            ['marketing-post-generator-mcp'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={'CLAUDE_API_KEY': api_key, 'MCP_MODE': 'local'},
            text=True
        )
    
    def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments}
        }
        
        self.process.stdin.write(json.dumps(request) + '\n')
        self.process.stdin.flush()
        
        response = self.process.stdout.readline()
        return json.loads(response)
    
    def call_prompt(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "prompts/get",
            "params": {"name": name, "arguments": arguments}
        }
        
        self.process.stdin.write(json.dumps(request) + '\n')
        self.process.stdin.flush()
        
        response = self.process.stdout.readline()
        return json.loads(response)

# Usage
client = MarketingPostGeneratorMCP("your_api_key")

# Initialize
client.call_prompt("init", {"domain": "blog.example.com"})

# Generate post
result = client.call_tool("write_post", {
    "title": "AI in Marketing",
    "topic": "artificial intelligence marketing",
    "wordCount": 1000
})
```

### Node.js MCP Client

```javascript
import { spawn } from 'child_process';

class MarketingPostGeneratorMCP {
  constructor(apiKey) {
    this.process = spawn('marketing-post-generator-mcp', [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLAUDE_API_KEY: apiKey, MCP_MODE: 'local' }
    });
    this.requestId = 1;
  }

  async callTool(name, arguments) {
    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: { name, arguments }
    };

    return new Promise((resolve, reject) => {
      this.process.stdout.once('data', (data) => {
        try {
          const response = JSON.parse(data.toString());
          resolve(response.result);
        } catch (error) {
          reject(error);
        }
      });

      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async callPrompt(name, arguments) {
    const request = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'prompts/get',
      params: { name, arguments }
    };

    return new Promise((resolve, reject) => {
      this.process.stdout.once('data', (data) => {
        try {
          const response = JSON.parse(data.toString());
          resolve(response.result);
        } catch (error) {
          reject(error);
        }
      });

      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }
}

// Usage
const client = new MarketingPostGeneratorMCP('your_api_key');

// Initialize and generate content
await client.callPrompt('init', { domain: 'blog.example.com' });
const result = await client.callTool('write_post', {
  title: 'AI in Marketing',
  topic: 'artificial intelligence marketing',
  wordCount: 1000
});
```

## 🛠️ Development

### Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run build           # Build TypeScript
npm run start           # Start production server

# Testing
npm test                # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage   # Test coverage report

# Code Quality
npm run lint            # ESLint check
npm run lint:fix        # Fix ESLint issues
npm run format          # Format with Prettier
npm run type-check      # TypeScript check

# Docker
npm run docker:build    # Build Docker image
npm run docker:run      # Run in container
npm run docker:dev      # Development with Docker Compose
```

### Running Different Modes

```bash
# Local MCP mode (default)
npm run start:local

# Remote HTTP mode
npm run start:remote

# Development with hot reload
npm run dev
```

## 🐳 Docker Deployment

### Development
```bash
docker-compose up --build
```

### Production
```bash
# Build image
docker build -t marketing-post-generator-mcp .

# Run container
docker run -d \
  -p 3000:3000 \
  -e CLAUDE_API_KEY=your_key_here \
  -v $(pwd)/.postgen:/app/.postgen \
  marketing-post-generator-mcp
```

## 🛟 Troubleshooting MCP Integration

### Common Issues

#### Server Not Found
```
Error: MCP server 'marketing-post-generator' not found
```
**Solutions:**
1. If using npx: Ensure you have Node.js 18+ and npm installed
2. If using global install: `npm list -g marketing-post-generator-mcp`
3. Check PATH: `which marketing-post-generator-mcp`
4. Try npx instead: `npx marketing-post-generator-mcp`
5. Reinstall: `npm install -g marketing-post-generator-mcp`

#### Authentication Errors
```
Error: Authentication failed
```
**Solutions:**
1. Verify Claude API key format (starts with `sk-ant-api03-`)
2. Check API key has sufficient credits
3. Ensure key is properly set in environment

#### JSON-RPC Errors
```
Error: Invalid JSON-RPC request
```
**Solutions:**
1. Ensure proper JSON-RPC 2.0 format
2. Check request ID is unique
3. Verify method names and parameters

#### Tool Not Available
```
Error: Tool 'sample' not found
```
**Solutions:**
1. Verify server is properly loaded
2. Check MCP client allowlist configuration
3. Restart MCP client after configuration changes

### Debug Mode

Enable debug logging:

```json
{
  "env": {
    "CLAUDE_API_KEY": "your_key",
    "LOG_LEVEL": "debug"
  }
}
```

### Test Server Manually

```bash
# Test server directly (installed version)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | marketing-post-generator-mcp

# Test server with npx
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx marketing-post-generator-mcp

# Test with environment variables
CLAUDE_API_KEY=your_key npx marketing-post-generator-mcp

# Expected response should list available tools
```

## 📚 Documentation

- **API Reference**: [docs/api/](./docs/api/) - Detailed API documentation
- **User Guide**: [docs/guides/user-guide.md](./docs/guides/user-guide.md) - Non-technical usage guide
- **Developer Guide**: [docs/guides/developer-guide.md](./docs/guides/developer-guide.md) - Contributing and extending
- **Claude Code Integration**: [examples/claude-code-integration.md](./examples/claude-code-integration.md) - Complete setup guide
- **Examples**: [examples/](./examples/) - Working code examples
- **Architecture**: [docs/architecture.md](./docs/architecture.md) - Technical architecture
- **Troubleshooting**: [docs/troubleshooting.md](./docs/troubleshooting.md) - Common issues and solutions

## 🤝 MCP Protocol Compliance

This server fully implements the MCP (Model Context Protocol) specification:

- ✅ **JSON-RPC 2.0**: Complete compliance with JSON-RPC protocol
- ✅ **Standard Methods**: Implements all required MCP methods
- ✅ **Error Handling**: Proper error codes and messages
- ✅ **Tool Registration**: Dynamic tool discovery and registration
- ✅ **Prompt Support**: Full prompt system implementation
- ✅ **Session Management**: Proper session initialization and cleanup
- ✅ **Transport Flexibility**: Both stdio and HTTP transports

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](./docs/)
- 🐛 [Issue Tracker](https://github.com/yourusername/marketing-post-generator-mcp/issues)
- 💬 [Discussions](https://github.com/yourusername/marketing-post-generator-mcp/discussions)

## 🙏 Acknowledgments

- Built with [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- Powered by [Anthropic Claude](https://www.anthropic.com/)
- Enhanced with [Firecrawl](https://firecrawl.dev/) for web scraping
- Containerized with [Docker](https://docker.com/)

---

**Ready to transform your content creation workflow with AI-powered MCP tools!** 🚀