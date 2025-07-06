# MCP Tools API Reference

This document provides comprehensive documentation for all available MCP tools in the Marketing Post Generator server.

## Overview

The Marketing Post Generator provides 6 main tools for content analysis, planning, and generation:

1. [sample](#sample-tool) - Domain content sampling and analysis
2. [summarize](#summarize-tool) - Individual post summarization
3. [generate_tone](#generate_tone-tool) - Tone of voice analysis
4. [content_plan](#content_plan-tool) - Strategic content planning
5. [generate_narrative](#generate_narrative-tool) - Post narrative generation
6. [write_post](#write_post-tool) - Complete blog post generation

## Authentication & Prerequisites

Before using any tools, ensure you have:
- A valid Claude API key configured in your environment
- Initialized the generator with the `init` prompt
- Required permissions for the target domain (for web scraping)

## Tool Reference

### sample Tool

**Name:** `sample`
**Description:** Sample blog posts from a domain to extract positioning, tone of voice, and content strategy.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `domain` | string | ✅ | - | The domain to sample blog posts from (e.g., "techcrunch.com") |
| `sampleSize` | number | ❌ | 5 | Number of blog posts to sample (min: 1, max: 20) |
| `maxRequestsPerSecond` | number | ❌ | 2 | Rate limiting for requests (min: 1, max: 10) |

#### Usage Examples

```bash
# Basic sampling
/sample domain="techcrunch.com"

# Sample with custom size and rate limit
/sample domain="blog.hubspot.com" sampleSize=10 maxRequestsPerSecond=1
```

#### Response Format

```json
{
  "domain": "example.com",
  "sampleSize": 5,
  "posts": [
    {
      "title": "Post Title",
      "url": "https://example.com/post-1",
      "publishedDate": "2024-01-15",
      "author": "Author Name",
      "excerpt": "Post excerpt..."
    }
  ],
  "analysis": {
    "positioning": "Technical thought leadership...",
    "toneOfVoice": "Professional, authoritative, approachable...",
    "contentStrategy": "Educational content with practical insights...",
    "keyThemes": ["AI", "Technology", "Business"],
    "writingStyle": "Conversational yet informative...",
    "targetAudience": "Technical professionals and decision makers..."
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### File Storage

Results are saved to `.postgen/analysis/samples/{domain-hash}.json`

#### Error Conditions

- **Invalid domain**: Domain is not accessible or doesn't exist
- **Rate limit exceeded**: Too many requests in a short period
- **No posts found**: Domain has no accessible blog posts
- **API quota exceeded**: Claude API quota reached

---

### summarize Tool

**Name:** `summarize`
**Description:** Generate a concise summary of a blog post from its URL.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | string | ✅ | - | The URL of the blog post to summarize |

#### Usage Examples

```bash
# Summarize a specific post
/summarize url="https://blog.example.com/ai-future-2024"

# Summarize with full URL
/summarize url="https://techcrunch.com/2024/01/15/ai-startup-funding/"
```

#### Response Format

```json
{
  "url": "https://example.com/post-1",
  "title": "The Future of AI in Marketing",
  "summary": "This article discusses emerging trends in AI-powered marketing...",
  "keyPoints": [
    "AI automation is transforming customer segmentation",
    "Personalization at scale is now achievable",
    "ROI measurement has improved with AI analytics"
  ],
  "wordCount": 1250,
  "readingTime": "5 minutes",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### File Storage

Summaries are saved to `.postgen/analysis/summaries/{url-hash}.json`

#### Error Conditions

- **Invalid URL**: URL is not accessible or doesn't exist
- **Content extraction failed**: Unable to extract readable content
- **Paywall detected**: Content is behind a paywall
- **Rate limit exceeded**: Too many summarization requests

---

### generate_tone Tool

**Name:** `generate_tone`
**Description:** Analyze content to determine the tone of voice used in a blog or specific post.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `source` | string | ✅ | - | URL of a specific post or domain name to analyze |
| `detailLevel` | string | ❌ | "detailed" | Analysis depth: "basic", "detailed", "comprehensive" |

#### Usage Examples

```bash
# Analyze domain tone
/generate_tone source="blog.stripe.com" detailLevel="comprehensive"

# Analyze specific post tone
/generate_tone source="https://blog.stripe.com/online-payments-guide"

# Basic tone analysis
/generate_tone source="techcrunch.com" detailLevel="basic"
```

#### Response Format

```json
{
  "source": "blog.stripe.com",
  "analysisType": "domain",
  "detailLevel": "comprehensive",
  "toneAnalysis": {
    "overallTone": "Professional, educational, trustworthy",
    "primaryCharacteristics": [
      "Authoritative without being intimidating",
      "Clear and jargon-free explanations",
      "Customer-focused language"
    ],
    "emotionalResonance": "Confident, helpful, reliable",
    "writingStyle": {
      "sentenceStructure": "Mix of short and medium sentences",
      "vocabulary": "Professional but accessible",
      "activePassiveRatio": "Predominantly active voice"
    },
    "targetAudience": "Business owners, developers, finance teams",
    "brandPersonality": ["Expert", "Approachable", "Innovative"],
    "communicationGoals": ["Educate", "Build trust", "Demonstrate expertise"]
  },
  "recommendations": [
    "Maintain clear, benefit-focused headlines",
    "Use concrete examples and case studies",
    "Include actionable insights in every piece"
  ],
  "sampleCount": 8,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Detail Levels

- **Basic**: Core tone characteristics and primary emotions
- **Detailed**: Includes writing style analysis and audience insights
- **Comprehensive**: Full analysis with recommendations and brand personality

#### File Storage

Results are saved to `.postgen/analysis/tone-analysis/{source-hash}.json`

#### Error Conditions

- **Source not accessible**: URL or domain cannot be reached
- **Insufficient content**: Not enough content to perform meaningful analysis
- **Invalid detail level**: Unsupported detail level specified

---

### content_plan Tool

**Name:** `content_plan`
**Description:** Create or update a comprehensive content plan for future blog posts.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `domain` | string | ✅ | - | The domain to create a content plan for |
| `timeframe` | string | ❌ | "month" | Planning period: "week", "month", "quarter" |
| `postCount` | number | ❌ | 8 | Number of posts to plan (min: 1, max: 50) |
| `updateExisting` | boolean | ❌ | false | Whether to update an existing plan or create new |

#### Usage Examples

```bash
# Create monthly content plan
/content_plan domain="techblog.com" timeframe="month" postCount=12

# Weekly content plan
/content_plan domain="startup.blog" timeframe="week" postCount=3

# Update existing quarterly plan
/content_plan domain="marketing.com" timeframe="quarter" updateExisting=true
```

#### Response Format

```json
{
  "domain": "techblog.com",
  "timeframe": "month",
  "generatedDate": "2024-01-15T10:30:00Z",
  "plan": [
    {
      "id": "post-1",
      "title": "The Future of AI Development Tools",
      "topic": "AI Development",
      "description": "Explore emerging AI tools that are transforming software development...",
      "keywords": ["AI", "development tools", "automation", "productivity"],
      "targetAudience": "Software developers and tech leads",
      "contentType": "Educational",
      "estimatedWordCount": 1500,
      "difficulty": "intermediate",
      "scheduledDate": "2024-02-01",
      "status": "planned"
    }
  ],
  "contentStrategy": {
    "themes": ["AI Innovation", "Developer Productivity", "Industry Trends"],
    "contentMix": {
      "educational": 40,
      "trending": 30,
      "promotional": 20,
      "community": 10
    },
    "keywordTargets": ["AI", "machine learning", "software development"],
    "competitorAnalysis": ["competitor-gaps", "trending-topics"]
  },
  "metadata": {
    "totalPosts": 12,
    "averageWordCount": 1200,
    "contentCategories": ["Technical", "Business", "Trends"],
    "estimatedHours": 48
  }
}
```

#### File Storage

Plans are saved to `.postgen/content-plans/{domain}-{timeframe}-{timestamp}.json`

#### Error Conditions

- **Domain not initialized**: Domain must be initialized first with init prompt
- **Invalid timeframe**: Unsupported timeframe specified
- **Post count exceeded**: Requested too many posts for the timeframe
- **No existing plan**: Tried to update non-existent plan

---

### generate_narrative Tool

**Name:** `generate_narrative`
**Description:** Generate detailed narratives and bullet points for upcoming posts based on the content plan.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `postId` | string | ✅ | - | ID of the post from the content plan |
| `style` | string | ❌ | "detailed" | Narrative style: "concise", "detailed", "storytelling" |
| `updateExisting` | boolean | ❌ | false | Whether to update existing narrative |

#### Usage Examples

```bash
# Generate detailed narrative
/generate_narrative postId="post-1" style="detailed"

# Storytelling style narrative
/generate_narrative postId="post-3" style="storytelling"

# Update existing narrative
/generate_narrative postId="post-1" updateExisting=true
```

#### Response Format

```json
{
  "postId": "post-1",
  "title": "The Future of AI Development Tools",
  "style": "detailed",
  "narrative": {
    "hook": "Every developer has experienced the frustration of repetitive coding tasks...",
    "introduction": {
      "context": "The landscape of software development is rapidly evolving...",
      "problemStatement": "Traditional development workflows are becoming bottlenecks...",
      "preview": "This article explores how AI-powered tools are revolutionizing..."
    },
    "mainPoints": [
      {
        "heading": "Current State of Development Tools",
        "keyPoints": [
          "Traditional IDEs and their limitations",
          "Time spent on repetitive tasks",
          "Developer productivity challenges"
        ],
        "supportingEvidence": ["Industry statistics", "Developer surveys"],
        "estimatedWordCount": 300
      },
      {
        "heading": "AI-Powered Development Revolution",
        "keyPoints": [
          "Code generation and completion",
          "Automated testing and debugging",
          "Intelligent code review"
        ],
        "supportingEvidence": ["Tool comparisons", "Performance metrics"],
        "estimatedWordCount": 400
      }
    ],
    "conclusion": {
      "summary": "AI development tools are not just improving productivity...",
      "callToAction": "Start experimenting with these tools today...",
      "futureOutlook": "The next decade will see even more revolutionary changes..."
    }
  },
  "metadata": {
    "estimatedWordCount": 1500,
    "estimatedReadingTime": "6 minutes",
    "targetKeywords": ["AI", "development tools", "productivity"],
    "contentStructure": "Problem-Solution-Future",
    "generatedDate": "2024-01-15T10:30:00Z"
  }
}
```

#### Narrative Styles

- **Concise**: Brief outlines with key points only
- **Detailed**: Comprehensive structure with supporting evidence
- **Storytelling**: Narrative-driven approach with emotional hooks

#### File Storage

Narratives are saved to `.postgen/narratives/{postId}-{timestamp}.json`

#### Error Conditions

- **Post not found**: PostId doesn't exist in any content plan
- **Invalid style**: Unsupported narrative style specified
- **Content plan missing**: No content plan exists for the domain

---

### write_post Tool

**Name:** `write_post`
**Description:** Write a complete blog post from scratch or based on a narrative.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `narrativeId` | string | ❌ | - | ID of the narrative to base the post on |
| `title` | string | ❌ | - | Title of the blog post (required if no narrativeId) |
| `topic` | string | ❌ | - | Topic of the blog post (required if no narrativeId) |
| `keywords` | string[] | ❌ | [] | Keywords for the blog post |
| `wordCount` | number | ❌ | 1000 | Target word count (min: 200, max: 5000) |
| `style` | string | ❌ | "informative" | Writing style (see options below) |
| `updateExisting` | boolean | ❌ | false | Whether to update an existing post |

#### Writing Styles

- **informative**: Educational and fact-based content
- **persuasive**: Convincing and argument-driven content
- **storytelling**: Narrative-driven with emotional engagement
- **technical**: Deep-dive technical content with examples
- **conversational**: Casual and approachable tone

#### Usage Examples

```bash
# From narrative
/write_post narrativeId="narrative-post-1" wordCount=1500

# From scratch - informative style
/write_post title="Getting Started with Docker" topic="containerization" keywords=["docker", "containers", "devops"] wordCount=1200 style="informative"

# Persuasive blog post
/write_post title="Why Your Startup Needs AI" topic="business AI adoption" style="persuasive" wordCount=800

# Technical deep-dive
/write_post title="Building Microservices with Node.js" topic="microservices architecture" style="technical" wordCount=2000
```

#### Response Format

```json
{
  "postId": "post-abc123",
  "title": "Getting Started with Docker: A Complete Guide",
  "content": "# Getting Started with Docker: A Complete Guide\n\nDocker has revolutionized...",
  "metadata": {
    "wordCount": 1247,
    "readingTime": "5 minutes",
    "keywords": ["docker", "containers", "devops"],
    "style": "informative",
    "targetAudience": "developers",
    "seoScore": 85
  },
  "frontmatter": {
    "title": "Getting Started with Docker: A Complete Guide",
    "date": "2024-01-15",
    "author": "Marketing Post Generator",
    "tags": ["docker", "containers", "devops", "tutorial"],
    "category": "Technology",
    "excerpt": "A comprehensive guide to getting started with Docker...",
    "featured_image": null,
    "seo": {
      "meta_description": "Learn Docker fundamentals with this comprehensive guide...",
      "keywords": "docker tutorial, containers, devops, getting started"
    }
  },
  "filePath": ".postgen/posts/drafts/getting-started-with-docker-abc123.md",
  "generatedDate": "2024-01-15T10:30:00Z"
}
```

#### Content Structure

Generated posts include:
- **Frontmatter**: SEO metadata and post information
- **Introduction**: Engaging opening with context
- **Main Content**: Structured sections with headings
- **Conclusion**: Summary and call-to-action
- **Internal Links**: Suggestions for related content

#### File Storage

Posts are saved to:
- Draft: `.postgen/posts/drafts/{sanitized-title}-{id}.md`
- Metadata: `.postgen/posts/drafts/{sanitized-title}-{id}.json`

#### Error Conditions

- **Missing required parameters**: Title and topic required when no narrativeId
- **Invalid word count**: Word count outside acceptable range
- **Narrative not found**: Specified narrativeId doesn't exist
- **Invalid style**: Unsupported writing style specified
- **API quota exceeded**: Claude API quota reached during generation

---

## Error Handling

All tools implement consistent error handling:

### Common Error Types

- **AuthenticationError**: Invalid or missing API keys
- **ValidationError**: Invalid parameters or missing required fields
- **NotFoundError**: Requested resource doesn't exist
- **RateLimitError**: API rate limits exceeded
- **NetworkError**: Connection issues or timeouts
- **QuotaExceededError**: API usage quotas exceeded

### Error Response Format

```json
{
  "error": {
    "type": "ValidationError",
    "message": "Invalid domain format",
    "code": "INVALID_DOMAIN",
    "details": {
      "parameter": "domain",
      "provided": "invalid-domain",
      "expected": "Valid domain name (e.g., 'example.com')"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Rate Limiting

All tools respect rate limiting:
- **Default**: 60 requests per minute
- **Configurable**: Via environment variables
- **Headers**: Rate limit info in response headers
- **Backoff**: Automatic retry with exponential backoff

## Caching

Tools implement intelligent caching:
- **Sample results**: Cached for 24 hours
- **Tone analysis**: Cached for 7 days
- **Summaries**: Cached for 30 days
- **Content plans**: Not cached (always fresh)
- **Narratives**: Not cached (allow iteration)
- **Posts**: Not cached (unique generation)

## Best Practices

1. **Initialize first**: Always run the `init` prompt before using tools
2. **Check existing data**: Use existing analysis when available
3. **Respect rate limits**: Don't overwhelm target domains
4. **Iterate on content**: Use narratives to refine posts before generation
5. **Monitor quotas**: Track API usage to avoid interruptions
6. **Backup important content**: Keep copies of generated posts
7. **Review generated content**: Always review and edit AI-generated content