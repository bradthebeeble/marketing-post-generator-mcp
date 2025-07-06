# MCP Transport Configuration

This document provides comprehensive information about the transport layer configuration for the Marketing Post Generator MCP server.

## Overview

The Marketing Post Generator supports two transport modes to accommodate different use cases:

1. **Local Mode (stdio)** - Direct integration with Claude Code and MCP clients
2. **Remote Mode (HTTP)** - Web-based server for programmatic access and API integration

## Transport Modes

### Local Mode (stdio)

**Best for:** Claude Code integration, desktop applications, CLI tools

Local mode uses standard input/output (stdio) for communication, making it ideal for direct integration with MCP clients like Claude Code.

#### Configuration

```bash
# Environment Variables
MCP_MODE=local
MCP_TRANSPORT=stdio

# Start the server
npm run start:local
```

#### Usage with Claude Code

1. **Install the server globally or locally**
   ```bash
   npm install -g marketing-post-generator-mcp
   ```

2. **Configure in Claude Code settings**
   ```json
   {
     "mcpServers": {
       "marketing-post-generator": {
         "command": "marketing-post-generator-mcp",
         "env": {
           "CLAUDE_API_KEY": "your_api_key_here"
         }
       }
     }
   }
   ```

3. **Use in Claude Code**
   ```
   /init domain="blog.example.com"
   /sample domain="blog.example.com"
   /write_post title="My Blog Post" topic="AI" wordCount=1000
   ```

#### Connection Details

- **Protocol**: MCP over stdio
- **Communication**: JSON-RPC 2.0
- **Process Model**: Long-running subprocess
- **Session Management**: Automatic with MCP client
- **Error Handling**: Standard MCP error responses

---

### Remote Mode (HTTP)

**Best for:** Web applications, API integrations, cloud deployments, multiple concurrent users

Remote mode provides an HTTP server with RESTful endpoints and Server-Sent Events (SSE) for real-time communication.

#### Configuration

```bash
# Environment Variables
MCP_MODE=remote
MCP_TRANSPORT=http
MCP_PORT=3000
MCP_HOST=0.0.0.0

# HTTP-specific settings
MCP_HTTP_JSON_RESPONSE=false
MCP_HTTP_DNS_PROTECTION=true
MCP_HTTP_ALLOWED_HOSTS=localhost,yourapp.com
MCP_HTTP_ALLOWED_ORIGINS=*

# Start the server
npm run start:remote
```

#### HTTP Endpoints

##### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "mode": "remote",
  "transport": "http",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600
}
```

##### MCP Communication
```http
POST /mcp
Content-Type: application/json
```

**Request Body:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "sample",
    "arguments": {
      "domain": "blog.example.com",
      "sampleSize": 5
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Analysis complete..."
      }
    ]
  }
}
```

##### Server-Sent Events (SSE)
```http
GET /events
Accept: text/event-stream
```

For real-time updates during long-running operations.

#### Security Features

##### CORS Configuration
```bash
# Allow specific origins
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Allow all origins (development only)
ALLOWED_ORIGINS=*
```

##### DNS Rebinding Protection
```bash
# Enable protection (recommended)
MCP_HTTP_DNS_PROTECTION=true

# Allowed hosts
MCP_HTTP_ALLOWED_HOSTS=localhost,yourdomain.com,api.yourdomain.com
```

##### Rate Limiting
```bash
# Requests per minute per IP
RATE_LIMIT_REQUESTS=60

# Burst allowance
RATE_LIMIT_BURST=10
```

#### Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  marketing-post-generator:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MCP_MODE=remote
      - MCP_PORT=3000
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - MCP_HTTP_DNS_PROTECTION=true
      - MCP_HTTP_ALLOWED_HOSTS=localhost,yourdomain.com
    volumes:
      - ./data/.postgen:/app/.postgen
```

---

## Configuration Reference

### Environment Variables

#### Core Configuration
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MCP_MODE` | string | `local` | Transport mode: `local` or `remote` |
| `MCP_TRANSPORT` | string | `stdio` | Transport type: `stdio` or `http` |
| `MCP_PORT` | number | `3000` | HTTP server port (remote mode only) |
| `MCP_HOST` | string | `0.0.0.0` | HTTP server host (remote mode only) |

#### HTTP Configuration (Remote Mode)
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MCP_HTTP_JSON_RESPONSE` | boolean | `false` | Force JSON responses (disable SSE) |
| `MCP_HTTP_DNS_PROTECTION` | boolean | `true` | Enable DNS rebinding protection |
| `MCP_HTTP_ALLOWED_HOSTS` | string | `localhost` | Comma-separated allowed hostnames |
| `MCP_HTTP_ALLOWED_ORIGINS` | string | `*` | Comma-separated allowed CORS origins |

#### Security Configuration
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ALLOWED_ORIGINS` | string | `*` | CORS allowed origins |
| `RATE_LIMIT_REQUESTS` | number | `60` | Requests per minute limit |
| `RATE_LIMIT_BURST` | number | `10` | Burst request allowance |

#### Logging Configuration
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_LEVEL` | string | `info` | Logging level: `error`, `warn`, `info`, `debug`, `trace` |
| `LOG_FORMAT` | string | `simple` | Log format: `simple`, `json`, `pretty` |

### Configuration Files

#### Package.json Scripts
```json
{
  "scripts": {
    "start": "node dist/index.js",
    "start:local": "MCP_MODE=local node dist/index.js",
    "start:remote": "MCP_MODE=remote node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "dev:remote": "MCP_MODE=remote tsx watch src/index.ts"
  }
}
```

#### .env.example
```bash
# MCP Server Configuration
MCP_MODE=local                                    # local or remote
MCP_TRANSPORT=stdio                               # stdio or http
MCP_PORT=3000                                     # Port for HTTP mode
MCP_HOST=0.0.0.0                                  # Host for HTTP mode

# HTTP Configuration (for remote mode)
MCP_HTTP_JSON_RESPONSE=false
MCP_HTTP_DNS_PROTECTION=true
MCP_HTTP_ALLOWED_HOSTS=localhost
MCP_HTTP_ALLOWED_ORIGINS=*

# CORS Configuration (for remote mode)
ALLOWED_ORIGINS=*
```

---

## Transport Comparison

| Feature | Local (stdio) | Remote (HTTP) |
|---------|---------------|---------------|
| **Use Case** | Claude Code, CLI tools | Web apps, APIs |
| **Performance** | Highest (direct) | High (HTTP overhead) |
| **Scalability** | Single process | Multiple concurrent |
| **Security** | Process isolation | Network security |
| **Deployment** | Local installation | Server deployment |
| **Real-time** | Synchronous | SSE support |
| **Authentication** | Process-based | Header/token-based |
| **Monitoring** | Process logs | HTTP metrics |

---

## Client Examples

### Local Mode Client (Node.js)

```javascript
import { spawn } from 'child_process';

class LocalMCPClient {
  constructor() {
    this.process = spawn('marketing-post-generator-mcp', [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        CLAUDE_API_KEY: 'your_api_key' 
      }
    });
  }

  async callTool(name, args) {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args }
    };

    this.process.stdin.write(JSON.stringify(request) + '\n');
    
    return new Promise((resolve, reject) => {
      this.process.stdout.once('data', (data) => {
        try {
          const response = JSON.parse(data.toString());
          resolve(response.result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
}

// Usage
const client = new LocalMCPClient();
const result = await client.callTool('sample', {
  domain: 'blog.example.com',
  sampleSize: 5
});
```

### Remote Mode Client (HTTP)

```javascript
class RemoteMCPClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async callTool(name, args) {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args }
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    const data = await response.json();
    return data.result;
  }

  // Subscribe to real-time events
  subscribeToEvents(callback) {
    const eventSource = new EventSource(`${this.baseUrl}/events`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
    };

    return eventSource;
  }
}

// Usage
const client = new RemoteMCPClient();
const result = await client.callTool('sample', {
  domain: 'blog.example.com'
});

// Subscribe to events
const eventSource = client.subscribeToEvents((event) => {
  console.log('Received event:', event);
});
```

---

## Troubleshooting

### Local Mode Issues

#### Process Not Starting
```bash
# Check if binary is available
which marketing-post-generator-mcp

# Check permissions
ls -la $(which marketing-post-generator-mcp)

# Run with debug logging
DEBUG=* marketing-post-generator-mcp
```

#### Communication Errors
```bash
# Check stdio buffering
export NODE_ENV=development

# Verify JSON-RPC format
echo '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}' | marketing-post-generator-mcp
```

### Remote Mode Issues

#### Port Already in Use
```bash
# Find process using the port
lsof -i :3000

# Kill the process
kill -9 <PID>

# Use different port
MCP_PORT=3001 npm run start:remote
```

#### CORS Errors
```bash
# Check CORS configuration
curl -H "Origin: https://yourapp.com" -I http://localhost:3000/health

# Update allowed origins
export ALLOWED_ORIGINS=https://yourapp.com,https://api.yourapp.com
```

#### DNS Rebinding Issues
```bash
# Disable protection temporarily
export MCP_HTTP_DNS_PROTECTION=false

# Add allowed hosts
export MCP_HTTP_ALLOWED_HOSTS=localhost,yourdomain.com,*.yourdomain.com
```

### Performance Optimization

#### Local Mode
- Use connection pooling for multiple tool calls
- Implement request batching where possible
- Monitor process memory usage

#### Remote Mode
- Configure reverse proxy (nginx) for production
- Enable HTTP/2 for better performance
- Implement response caching for static data
- Use compression middleware

### Monitoring and Logging

#### Local Mode Monitoring
```bash
# Monitor process
ps aux | grep marketing-post-generator-mcp

# Check logs
tail -f ~/.local/share/marketing-post-generator/logs/app.log
```

#### Remote Mode Monitoring
```bash
# Check server status
curl http://localhost:3000/health

# Monitor HTTP access logs
tail -f /var/log/nginx/access.log

# Application metrics
curl http://localhost:3000/metrics
```

This completes the transport configuration documentation, covering both local and remote modes with comprehensive setup, security, and troubleshooting information.