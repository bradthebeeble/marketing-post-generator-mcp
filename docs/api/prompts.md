# MCP Prompts API Reference

This document provides comprehensive documentation for all available MCP prompts in the Marketing Post Generator server.

## Overview

The Marketing Post Generator currently provides 1 main prompt for initialization:

1. [init](#init-prompt) - Initialize the Marketing Post Generator with a blog domain

## Prompt Reference

### init Prompt

**Name:** `init`
**Description:** Initialize the Marketing Post Generator with a blog domain to set up the .postgen directory structure and configuration.

#### Purpose

The `init` prompt is the first step in using the Marketing Post Generator. It:
- Creates the `.postgen` directory structure for data storage
- Validates the provided domain
- Sets up configuration files
- Prepares the system for content analysis and generation

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `domain` | string | ✅ | - | The domain/URL of the main blog page (e.g., "https://blog.example.com" or "blog.example.com") |

#### Usage Examples

```bash
# Initialize with full URL
/init domain="https://blog.stripe.com"

# Initialize with domain only
/init domain="techcrunch.com"

# Initialize with subdomain
/init domain="engineering.shopify.com"
```

#### Response Format

```json
{
  "success": true,
  "domain": "blog.stripe.com",
  "message": "Marketing Post Generator initialized successfully for blog.stripe.com",
  "configuration": {
    "domain": "blog.stripe.com",
    "initialized": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  },
  "directoryStructure": {
    "created": [
      ".postgen/",
      ".postgen/analysis/",
      ".postgen/analysis/samples/",
      ".postgen/analysis/tone-analysis/",
      ".postgen/analysis/summaries/",
      ".postgen/content-plans/",
      ".postgen/narratives/",
      ".postgen/posts/",
      ".postgen/posts/drafts/",
      ".postgen/posts/published/"
    ],
    "configFile": ".postgen/config.json"
  }
}
```

#### Directory Structure Created

The init prompt creates the following directory structure:

```
.postgen/
├── config.json                    # Domain configuration and metadata
├── analysis/                      # Content analysis results
│   ├── samples/                   # Domain sampling results
│   ├── tone-analysis/             # Tone analysis results
│   └── summaries/                 # Individual post summaries
├── content-plans/                 # Strategic content plans
├── narratives/                    # Generated post narratives
└── posts/                         # Generated blog posts
    ├── drafts/                    # Work-in-progress posts
    └── published/                 # Final, ready-to-publish posts
```

#### Configuration File

The init prompt creates a `config.json` file with the following structure:

```json
{
  "domain": "blog.stripe.com",
  "initialized": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "settings": {
    "defaultSampleSize": 5,
    "maxRequestsPerSecond": 2,
    "cacheEnabled": true,
    "cacheTtl": 3600000
  },
  "metadata": {
    "lastUsed": "2024-01-15T10:30:00Z",
    "totalSamples": 0,
    "totalSummaries": 0,
    "totalPlans": 0,
    "totalNarratives": 0,
    "totalPosts": 0
  }
}
```

#### Domain Validation

The init prompt performs several validation checks:

1. **Format Validation**: Ensures the domain is in a valid format
2. **Accessibility Check**: Verifies the domain is accessible
3. **Blog Detection**: Attempts to identify blog content structure
4. **Rate Limit Test**: Checks if the domain has reasonable rate limits

#### Use Cases

##### 1. First-Time Setup

```bash
# Start fresh with a new domain
/init domain="blog.example.com"
```

This is the most common use case when starting work with a new blog domain.

##### 2. Re-initialization

```bash
# Re-initialize existing domain (resets configuration)
/init domain="blog.example.com"
```

This overwrites existing configuration but preserves generated content files.

##### 3. Multi-Domain Workflow

```bash
# Initialize different domains in different directories
cd project-a
/init domain="blog-a.com"

cd ../project-b  
/init domain="blog-b.com"
```

Each directory can have its own `.postgen` configuration for different clients or projects.

#### Error Handling

##### Common Errors

**Invalid Domain Format**
```json
{
  "error": {
    "type": "ValidationError",
    "message": "Invalid domain format",
    "code": "INVALID_DOMAIN_FORMAT",
    "details": {
      "provided": "not-a-domain",
      "expected": "Valid domain (e.g., 'blog.example.com' or 'https://blog.example.com')"
    }
  }
}
```

**Domain Not Accessible**
```json
{
  "error": {
    "type": "NetworkError", 
    "message": "Domain is not accessible",
    "code": "DOMAIN_UNREACHABLE",
    "details": {
      "domain": "nonexistent-blog.com",
      "httpStatus": 404,
      "suggestion": "Verify the domain exists and is publicly accessible"
    }
  }
}
```

**Permission Denied**
```json
{
  "error": {
    "type": "FileSystemError",
    "message": "Cannot create .postgen directory",
    "code": "INSUFFICIENT_PERMISSIONS",
    "details": {
      "path": ".postgen/",
      "suggestion": "Ensure write permissions in the current directory"
    }
  }
}
```

**Already Initialized**
```json
{
  "warning": {
    "type": "ConfigurationWarning",
    "message": "Domain already initialized",
    "code": "ALREADY_INITIALIZED",
    "details": {
      "existingDomain": "blog.example.com",
      "initializedDate": "2024-01-14T15:20:00Z",
      "action": "Configuration updated with new timestamp"
    }
  }
}
```

#### Best Practices

##### 1. Domain Selection

- **Use the root blog domain**: `blog.example.com` rather than specific post URLs
- **Include subdomain if relevant**: `engineering.company.com` for technical blogs
- **Prefer HTTPS**: Use `https://blog.example.com` when available

##### 2. Directory Management

- **One domain per directory**: Keep each client/project in separate directories
- **Version control**: Consider adding `.postgen/` to `.gitignore` for sensitive content
- **Backup important files**: Save generated content that you want to preserve

##### 3. Workflow Integration

```bash
# Recommended initialization workflow
cd my-blog-project
/init domain="blog.client.com"
/sample domain="blog.client.com" sampleSize=8
/content_plan domain="blog.client.com" timeframe="month"
```

##### 4. Domain Testing

Before full initialization, you can test domain accessibility:

```bash
# Test if domain is accessible
curl -I https://blog.example.com

# Check for robots.txt restrictions
curl https://blog.example.com/robots.txt
```

#### Integration with Tools

After successful initialization, all tools will use the configured domain context:

- **sample**: Will reference the initialized domain for analysis
- **content_plan**: Will use domain-specific content strategy
- **generate_tone**: Will leverage domain context for tone consistency
- **write_post**: Will align with domain's established style

#### Troubleshooting

##### Issue: Permission Denied
**Solution**: Ensure you have write permissions in the current directory
```bash
chmod 755 .
```

##### Issue: Domain Validation Fails
**Solution**: Check domain accessibility and format
```bash
# Test domain manually
curl -I https://your-domain.com
ping your-domain.com
```

##### Issue: Configuration Corruption
**Solution**: Remove and reinitialize
```bash
rm -rf .postgen/
/init domain="your-domain.com"
```

##### Issue: Network Timeouts
**Solution**: Check internet connection and domain status
```bash
# Check if domain is responding
curl --connect-timeout 10 https://your-domain.com
```

#### Security Considerations

1. **Domain Verification**: The init prompt validates domains to prevent malicious redirects
2. **Local Storage**: All data is stored locally in the `.postgen` directory
3. **No External Dependencies**: Initialization doesn't require external services beyond domain validation
4. **Permission Scope**: Only creates files in the current directory structure

#### Migration and Backup

##### Backing Up Configuration
```bash
# Backup entire postgen directory
tar -czf postgen-backup-$(date +%Y%m%d).tar.gz .postgen/

# Backup just configuration
cp .postgen/config.json config-backup.json
```

##### Migrating Between Machines
```bash
# Copy entire postgen directory to new machine
scp -r .postgen/ user@newmachine:/path/to/project/

# Or use git (if tracking postgen files)
git add .postgen/
git commit -m "Add postgen configuration"
```

#### Advanced Usage

##### Custom Configuration
After initialization, you can manually edit `.postgen/config.json`:

```json
{
  "domain": "blog.example.com",
  "settings": {
    "defaultSampleSize": 10,        // Increased default
    "maxRequestsPerSecond": 1,      // More conservative rate limiting
    "cacheEnabled": false,          // Disable caching
    "customUserAgent": "MyBot/1.0"  // Custom user agent
  }
}
```

##### Batch Initialization
For multiple domains:

```bash
#!/bin/bash
domains=("blog1.com" "blog2.com" "blog3.com")
for domain in "${domains[@]}"; do
    mkdir -p "$domain"
    cd "$domain"
    /init domain="$domain"
    cd ..
done
```

This completes the init prompt documentation. The init prompt is essential for setting up the Marketing Post Generator environment and should be the first command used in any workflow.