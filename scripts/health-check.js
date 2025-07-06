#!/usr/bin/env node

/**
 * Health Check Script for Marketing Post Generator MCP Server
 * Used by Docker health checks to verify server responsiveness
 */

import http from 'http';

const PORT = process.env.MCP_PORT || 3000;
const HOST = process.env.MCP_HOST || 'localhost';
const TIMEOUT = 5000; // 5 seconds timeout

async function performHealthCheck() {
  // Validate configuration
  if (!HOST || !PORT || isNaN(Number(PORT))) {
    throw new Error('Invalid HOST or PORT configuration');
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: Number(PORT),
      path: '/health',
      method: 'GET',
      timeout: TIMEOUT,
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const health = JSON.parse(data);
            if (health && typeof health === 'object' && health.status === 'healthy') {
              console.log('✓ Health check passed:', health);
              resolve(true);
            } else {
              console.error('✗ Health check failed - unhealthy status:', health);
              reject(new Error('Server reported unhealthy status'));
            }
          } catch (error) {
            console.error('✗ Health check failed - invalid JSON response:', data);
            reject(new Error('Invalid health check response'));
          }
        } else {
          console.error(`✗ Health check failed - HTTP ${res.statusCode}`);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('✗ Health check failed - connection error:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.error('✗ Health check failed - timeout');
      req.abort(); // Explicit cleanup
      req.destroy();
      reject(new Error('Health check timeout'));
    });

    req.end();
  });
}

// Run health check
performHealthCheck()
  .then(() => {
    console.log('Health check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Health check failed:', {
      message: error.message,
      host: HOST,
      port: PORT,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  });