# Marketing Post Generator MCP

[![npm version](https://badge.fury.io/js/marketing-post-generator-mcp.svg)](https://badge.fury.io/js/marketing-post-generator-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

A powerful MCP (Model Context Protocol) server that leverages AI to automate the creation of marketing blog posts, content planning, and tone analysis. Built with TypeScript, Express, and integrated with Claude AI for intelligent content generation.

## ✨ Features

- 🔍 **Content Sampling**: Analyze existing blog posts from any domain to extract positioning, tone, and content strategy
- 📝 **Post Summarization**: Generate concise summaries of individual blog posts
- 🎯 **Tone Analysis**: Determine the tone of voice used in blogs or specific posts
- 📋 **Content Planning**: Create strategic content plans for future posts based on domain expertise and trends
- 📖 **Narrative Generation**: Create detailed narratives and bullet points for upcoming posts
- ✍️ **Blog Post Generation**: Write complete blog posts from scratch or based on narratives
- 🐳 **Docker Support**: Containerized deployment for easy scaling
- 🔄 **Dual Transport**: Supports both local (stdio) and remote (HTTP) modes
- 🛡️ **Security**: Built-in CORS, DNS rebinding protection, and rate limiting

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** or **yarn** package manager
- **Claude API key** from Anthropic

### Installation

#### Option 1: Install from npm (when published)

```bash
npm install -g marketing-post-generator-mcp
```

#### Option 2: Clone and build from source

```bash
git clone https://github.com/yourusername/marketing-post-generator-mcp.git
cd marketing-post-generator-mcp
npm install
npm run build
```

### Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` and add your API keys:
```bash
# Required
CLAUDE_API_KEY="your_claude_api_key_here"

# Optional (for enhanced functionality)
FIRECRAWL_API_KEY="your_firecrawl_api_key_here"
PERPLEXITY_API_KEY="your_perplexity_api_key_here"

# MCP Configuration
MCP_MODE=local          # or 'remote'
MCP_PORT=3000          # for remote mode
MCP_HOST=0.0.0.0       # for remote mode
```

### Running the Server

#### Local Mode (for Claude Code integration)
```bash
npm run start:local
```

#### Remote Mode (HTTP server)
```bash
npm run start:remote
```

#### Using Docker
```bash
# Development
docker-compose up --build

# Production
docker run -p 3000:3000 -e CLAUDE_API_KEY=your_key_here marketing-post-generator-mcp
```

## 📖 Usage

### Initialization

Before using any tools, initialize the generator with your blog domain:

```
/init domain="https://yourblog.com"
```

This creates a `.postgen` directory structure for storing generated content and analysis.

### Available Tools

#### 1. **sample** - Content Sampling and Analysis

Analyze existing blog posts from a domain to understand positioning and tone:

```
/sample domain="yourblog.com" sampleSize=5 maxRequestsPerSecond=2
```

**Parameters:**
- `domain` (required): Domain to sample blog posts from
- `sampleSize` (optional): Number of posts to sample (default: 5, max: 20)
- `maxRequestsPerSecond` (optional): Rate limiting (default: 2)

#### 2. **summarize** - Blog Post Summarization

Generate a concise summary of a specific blog post:

```
/summarize url="https://yourblog.com/specific-post"
```

**Parameters:**
- `url` (required): URL of the blog post to summarize

#### 3. **generate_tone** - Tone Analysis

Analyze the tone of voice used in content:

```
/generate_tone source="yourblog.com" detailLevel="detailed"
```

**Parameters:**
- `source` (required): URL of specific post or domain name
- `detailLevel` (optional): Analysis depth (`basic`, `detailed`, `comprehensive`)

#### 4. **content_plan** - Strategic Content Planning

Create a comprehensive content plan for future posts:

```
/content_plan domain="yourblog.com" timeframe="month" postCount=8
```

**Parameters:**
- `domain` (required): Domain to create content plan for
- `timeframe` (optional): Planning period (`week`, `month`, `quarter`)
- `postCount` (optional): Number of posts to plan (default: 8)
- `updateExisting` (optional): Update existing plan (default: false)

#### 5. **generate_narrative** - Post Narrative Creation

Generate detailed outlines for upcoming posts:

```
/generate_narrative postId="post-123" style="detailed"
```

**Parameters:**
- `postId` (required): ID from content plan
- `style` (optional): Narrative style (`concise`, `detailed`, `storytelling`)
- `updateExisting` (optional): Update existing narrative (default: false)

#### 6. **write_post** - Complete Blog Post Generation

Write full blog posts from scratch or based on narratives:

```bash
# From narrative
/write_post narrativeId="narrative-123" wordCount=1500

# From scratch
/write_post title="My Blog Post" topic="AI Content Generation" wordCount=1000 style="informative"
```

**Parameters:**
- `narrativeId` (optional): Base post on existing narrative
- `title` (optional): Post title (required if no narrativeId)
- `topic` (optional): Post topic (required if no narrativeId)
- `keywords` (optional): Array of target keywords
- `wordCount` (optional): Target word count (default: 1000)
- `style` (optional): Writing style (`informative`, `persuasive`, `storytelling`, `technical`, `conversational`)
- `updateExisting` (optional): Update existing post (default: false)

## 🔄 Complete Workflow Examples

### Example 1: End-to-End Content Generation

```bash
# 1. Initialize with your domain
/init domain="https://techblog.com"

# 2. Sample existing content to understand style
/sample domain="techblog.com" sampleSize=5

# 3. Analyze tone for consistency
/generate_tone source="techblog.com" detailLevel="comprehensive"

# 4. Create a monthly content plan
/content_plan domain="techblog.com" timeframe="month" postCount=8

# 5. Generate narrative for first post
/generate_narrative postId="post-1" style="detailed"

# 6. Write the complete blog post
/write_post narrativeId="narrative-1" wordCount=1500
```

### Example 2: Quick Post from Idea

```bash
# Initialize once
/init domain="https://yourblog.com"

# Generate post directly from idea
/write_post title="The Future of AI in Marketing" topic="AI and Marketing Automation" keywords=["AI", "marketing", "automation"] wordCount=1200 style="informative"
```

## 📁 File Structure

The tool creates the following structure in your working directory:

```
.postgen/
├── config.json          # Domain configuration
├── analysis/
│   ├── samples/          # Domain sampling results
│   ├── tone-analysis/    # Tone analysis results
│   └── summaries/        # Post summaries
├── content-plans/        # Strategic content plans
├── narratives/          # Generated post narratives
└── posts/               # Generated blog posts
    ├── published/       # Final posts
    └── drafts/          # Work in progress
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

### Environment Variables

See [.env.example](./.env.example) for complete configuration options.

**Required:**
- `CLAUDE_API_KEY`: Anthropic Claude API key

**Optional:**
- `FIRECRAWL_API_KEY`: Enhanced web scraping capabilities
- `PERPLEXITY_API_KEY`: Research-backed content generation
- Various MCP and logging configuration options

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

## 📚 Documentation

- [API Reference](./docs/api/) - Detailed API documentation
- [User Guide](./docs/guides/user-guide.md) - Non-technical usage guide
- [Developer Guide](./docs/guides/developer-guide.md) - Contributing and extending
- [Deployment Guide](./docs/guides/deployment-guide.md) - Production deployment
- [Architecture Overview](./docs/architecture.md) - Technical architecture
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

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

**Made with ❤️ for content creators and marketers**