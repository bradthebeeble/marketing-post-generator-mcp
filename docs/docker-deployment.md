# Docker Deployment Guide

This guide covers containerized deployment of the Marketing Post Generator MCP Server using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Deployment Modes](#deployment-modes)
- [Scripts and Automation](#scripts-and-automation)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Prerequisites

### Required Software

- **Docker Engine**: Version 20.10 or later
- **Docker Compose**: Version 2.0 or later
- **Node.js**: Version 18 or later (for local development)

### System Requirements

- **Memory**: Minimum 512MB, Recommended 1GB
- **CPU**: Minimum 1 core, Recommended 2 cores
- **Disk**: Minimum 2GB free space for images and data
- **Network**: Ports 3000 (and optionally 80/443 for reverse proxy)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd marketing-post-generator-mcp
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables (required)
nano .env
```

### 3. Build and Run

```bash
# Build and start services
npm run docker:dev

# Or manually with Docker Compose
docker-compose up --build
```

### 4. Verify Deployment

```bash
# Check health endpoint
curl http://localhost:3000/health

# View logs
docker-compose logs -f
```

## Environment Configuration

### Required Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CLAUDE_API_KEY` | Anthropic Claude API key | - | Yes |
| `NODE_ENV` | Node environment | `production` | No |
| `MCP_MODE` | Server mode (local/remote) | `remote` | No |
| `MCP_PORT` | Server port | `3000` | No |
| `LOG_LEVEL` | Logging level | `info` | No |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGEN_DATA_DIR` | Data directory path | `/data/.postgen` |
| `PORT` | External port mapping | `3000` |
| `VERSION` | Image version tag | `latest` |
| `DATA_DIR` | Host data directory | `./data` |
| `LOGS_DIR` | Host logs directory | `./logs` |

### Environment Files

Create environment-specific files:

```bash
# Development
.env.dev
NODE_ENV=development
MCP_MODE=local
LOG_LEVEL=debug
CLAUDE_API_KEY=your_dev_key

# Production
.env.prod
NODE_ENV=production
MCP_MODE=remote
LOG_LEVEL=info
CLAUDE_API_KEY=your_prod_key
VERSION=1.0.0
```

## Deployment Modes

### Development Mode

For local development with hot reloading:

```bash
# Using npm script
npm run docker:dev

# Using compose directly
docker-compose up --build marketing-post-generator-dev
```

Features:
- Volume mounting for live code changes
- Debug logging enabled
- Local stdio mode for MCP
- Development dependencies included

### Production Mode

For production deployment:

```bash
# Using production compose file
docker-compose -f docker-compose.prod.yml up -d

# Using deployment script
./scripts/docker-deploy.sh --environment production
```

Features:
- Optimized image size
- Security hardening
- Resource limits
- Health checks
- Restart policies

### Staging Mode

For staging environments:

```bash
# Using environment override
ENVIRONMENT=staging ./scripts/docker-deploy.sh
```

## Scripts and Automation

### Build Script

```bash
# Build production image
./scripts/docker-build.sh

# Build specific target
./scripts/docker-build.sh --target development --version 1.2.3

# Build both images
./scripts/docker-build.sh --target both
```

Options:
- `--target`: `production`, `development`, or `both`
- `--version`: Image version tag
- Environment: `NODE_ENV`, `BUILD_TARGET`, `VERSION`

### Deploy Script

```bash
# Deploy to production
./scripts/docker-deploy.sh

# Deploy specific version to staging
./scripts/docker-deploy.sh --environment staging --version 1.2.3

# Deploy with custom compose file
./scripts/docker-deploy.sh --compose-file docker-compose.custom.yml
```

Commands:
- `deploy`: Deploy application (default)
- `rollback`: Rollback deployment
- `status`: Show deployment status
- `logs`: Show application logs

### Cleanup Script

```bash
# Show current status
./scripts/docker-cleanup.sh status

# Clean containers only
./scripts/docker-cleanup.sh containers

# Full cleanup (with confirmation)
./scripts/docker-cleanup.sh full

# Force cleanup without confirmation
./scripts/docker-cleanup.sh full --force
```

Options:
- `--force`: Skip confirmation prompts
- `--all-images`: Remove all images (not just dangling)
- `--data`: Include data volumes (DESTRUCTIVE)

## Monitoring and Health Checks

### Health Check Endpoint

The server provides a health check endpoint at `/health`:

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "server": "marketing-post-generator-mcp",
  "version": "1.0.0"
}
```

### Docker Health Checks

Health checks are configured in Docker Compose:

```yaml
healthcheck:
  test: ["CMD", "node", "/app/scripts/health-check.js"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Monitoring with Prometheus (Optional)

Enable monitoring profile:

```bash
docker-compose -f docker-compose.prod.yml --profile monitoring up -d
```

Access Prometheus at: <http://localhost:9090>

## Production Deployment

### 1. Prepare Environment

```bash
# Create production directories
sudo mkdir -p /opt/marketing-post-generator/{data,logs}
sudo chown $(whoami):$(whoami) /opt/marketing-post-generator

# Create environment file
cat > .env.prod << EOF
NODE_ENV=production
VERSION=1.0.0
CLAUDE_API_KEY=your_production_key
DATA_DIR=/opt/marketing-post-generator/data
LOGS_DIR=/opt/marketing-post-generator/logs
EOF
```

### 2. Deploy with Production Configuration

```bash
# Deploy using production compose file
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Or use deployment script
ENVIRONMENT=production ./scripts/docker-deploy.sh
```

### 3. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Test health endpoint
curl http://localhost:3000/health

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 4. Set Up Reverse Proxy (Optional)

Enable nginx proxy:

```bash
# Create nginx configuration
mkdir -p nginx
# ... configure nginx.conf

# Start with proxy profile
docker-compose -f docker-compose.prod.yml --profile proxy up -d
```

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check container logs
docker-compose logs marketing-post-generator

# Check if required environment variables are set
docker-compose config

# Verify image was built correctly
docker images | grep marketing-post-generator
```

#### Health Check Failing

```bash
# Test health check manually
docker exec -it marketing-post-generator node scripts/health-check.js

# Check if server is responding
docker exec -it marketing-post-generator curl -f http://localhost:3000/health
```

#### Volume Mount Issues

```bash
# Check volume mounts
docker inspect marketing-post-generator | grep -A 10 "Mounts"

# Verify host directory permissions
ls -la ./data/.postgen
```

#### Memory/Resource Issues

```bash
# Check resource usage
docker stats

# Review resource limits
docker-compose config | grep -A 5 "deploy:"
```

### Debug Mode

Enable debug logging:

```bash
# Set debug environment
export LOG_LEVEL=debug

# Restart with debug logging
docker-compose up -d --force-recreate
```

### Log Analysis

```bash
# View all logs
docker-compose logs -f

# Filter by service
docker-compose logs -f marketing-post-generator

# Search logs for errors
docker-compose logs | grep -i error

# Export logs for analysis
docker-compose logs --no-color > deployment.log
```

## Security Considerations

### Container Security

- **Non-root user**: Containers run as non-privileged user `mcpserver`
- **Read-only filesystem**: Root filesystem is read-only in production
- **No new privileges**: Security option prevents privilege escalation
- **Resource limits**: Memory and CPU limits prevent resource exhaustion

### Network Security

- **Isolated network**: Services communicate on a dedicated bridge network
- **Port exposure**: Only necessary ports are exposed to host
- **CORS configuration**: Proper CORS headers for browser security

### Data Security

- **Volume encryption**: Use encrypted storage for persistent volumes
- **Secrets management**: Store API keys in secure secret stores
- **Regular updates**: Keep base images updated with security patches

### Production Hardening

```bash
# Run security scan
docker scout cves marketing-post-generator-mcp:latest

# Check for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image marketing-post-generator-mcp:latest
```

### Environment Variable Security

Never commit sensitive environment variables:

```bash
# Use .env.local for sensitive values
echo ".env.local" >> .gitignore

# Use Docker secrets in production
docker secret create claude_api_key /path/to/secret/file
```

## Performance Optimization

### Resource Tuning

Adjust resource limits based on load:

```yaml
deploy:
  resources:
    limits:
      memory: 2G      # Increase for high load
      cpus: '2.0'     # Scale with CPU requirements
    reservations:
      memory: 1G
      cpus: '1.0'
```

### Scaling

Scale services horizontally:

```bash
# Scale to multiple instances
docker-compose up -d --scale marketing-post-generator=3

# Use load balancer
docker-compose -f docker-compose.prod.yml --profile proxy up -d
```

### Monitoring Performance

```bash
# Monitor resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Profile application
docker exec -it marketing-post-generator node --prof dist/index.js
```

---

For additional support, please refer to the project documentation or create an issue in the repository.