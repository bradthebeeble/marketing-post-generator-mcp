# Multi-stage Docker build for Marketing Post Generator MCP

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install all dependencies (including dev for build)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Production stage
FROM node:18-alpine AS production

# Security hardening
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpserver -u 1001 -G nodejs

WORKDIR /app

# Copy production dependencies and built application
COPY --from=builder --chown=mcpserver:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcpserver:nodejs /app/dist ./dist
COPY --from=builder --chown=mcpserver:nodejs /app/package*.json ./

# Create data directory
RUN mkdir -p /data/.postgen && \
    chown -R mcpserver:nodejs /data

# Security: run as non-root user
USER mcpserver

# Environment configuration
ENV NODE_ENV=production
ENV MCP_MODE=remote
ENV MCP_PORT=3000
ENV POSTGEN_DATA_DIR=/data/.postgen

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/index.js"]