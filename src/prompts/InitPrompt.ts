import { MCPPrompt, PromptFactory } from '../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger.js';
import winston from 'winston';

export interface InitPromptArguments {
  domain: string;
}

export interface PostgenConfig {
  domain: string;
  initialized: string;
  version: string;
}

export class InitPrompt implements PromptFactory {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = createLogger({
      level: 'info',
      format: 'simple',
    });
  }

  getPromptName(): string {
    return 'init';
  }

  getPromptDescription(): string {
    return 'Initialize the Marketing Post Generator with a blog domain';
  }

  createPrompt(): MCPPrompt {
    return {
      name: this.getPromptName(),
      description: this.getPromptDescription(),
      arguments: [
        {
          name: 'domain',
          description: 'The domain/URL of the main blog page',
          required: true,
        },
      ],
    };
  }

  async executePrompt(args: InitPromptArguments): Promise<string> {
    try {
      this.logger.info('Initializing Marketing Post Generator', { domain: args.domain });

      // Validate domain
      const url = this.validateDomain(args.domain);

      // Create .postgen directory structure
      const postgenDir = path.join(process.cwd(), '.postgen');
      await this.createDirectoryStructure(postgenDir);

      // Create config file
      const config: PostgenConfig = {
        domain: url.hostname,
        initialized: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      };

      await this.createConfigFile(postgenDir, config);

      const message = `Successfully initialized .postgen directory for ${url.hostname}`;
      this.logger.info(message);

      return message;
    } catch (error) {
      const errorMessage = `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMessage, { error });
      throw new Error(errorMessage);
    }
  }

  private validateDomain(domain: string): URL {
    try {
      // Add protocol if missing
      const urlString =
        domain.startsWith('http://') || domain.startsWith('https://')
          ? domain
          : `https://${domain}`;

      const url = new URL(urlString);

      // Validate that it's a proper HTTP/HTTPS URL
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Domain must be a valid HTTP or HTTPS URL');
      }

      // Validate hostname
      if (!url.hostname || url.hostname.length === 0) {
        throw new Error('Domain must have a valid hostname');
      }

      return url;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Invalid domain format: ${error.message}`);
      }
      throw new Error(`Invalid domain format: ${String(error)}`);
    }
  }

  private async createDirectoryStructure(postgenDir: string): Promise<void> {
    try {
      // Create main .postgen directory
      await fs.mkdir(postgenDir, { recursive: true });

      // Create subdirectories
      const subdirectories = [
        'samples', // For sampled blog posts
        'summaries', // For post summaries
        'content-plans', // For content planning
        'posts', // For generated posts
        'analysis', // For tone and positioning analysis
        'cache', // For caching external requests
      ];

      for (const dir of subdirectories) {
        const dirPath = path.join(postgenDir, dir);
        await fs.mkdir(dirPath, { recursive: true });
        this.logger.debug(`Created directory: ${dirPath}`);
      }

      this.logger.info('Directory structure created successfully');
    } catch (error) {
      throw new Error(
        `Failed to create directory structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async createConfigFile(postgenDir: string, config: PostgenConfig): Promise<void> {
    try {
      const configPath = path.join(postgenDir, 'config.json');
      const configContent = JSON.stringify(config, null, 2);

      await fs.writeFile(configPath, configContent, 'utf8');

      this.logger.info('Configuration file created', { path: configPath });
    } catch (error) {
      throw new Error(
        `Failed to create config file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
