import winston from 'winston';
import { DIContainer } from '../container/DIContainer.js';
import { ToolAndPromptRegistry } from './ToolAndPromptRegistry.js';
import { RegistryValidator } from './RegistryValidator.js';
import { VersionManager } from './VersionManager.js';
import { DiscoveryService } from './DiscoveryService.js';
import { RegistryConfig } from './types.js';

/**
 * Service tokens for dependency injection
 */
export const REGISTRY_TOKENS = {
  TOOL_AND_PROMPT_REGISTRY: 'ToolAndPromptRegistry',
  REGISTRY_VALIDATOR: 'RegistryValidator',
  VERSION_MANAGER: 'VersionManager',
  DISCOVERY_SERVICE: 'DiscoveryService',
  REGISTRY_CONFIG: 'RegistryConfig',
  REGISTRY_LOGGER: 'RegistryLogger',
} as const;

/**
 * Configuration options for registry factory
 */
export interface RegistryFactoryConfig {
  registryConfig?: Partial<RegistryConfig>;
  loggerConfig?: winston.LoggerOptions;
  enableValidation?: boolean;
  enableVersioning?: boolean;
  enableDiscovery?: boolean;
}

/**
 * Factory for creating and configuring registry services with dependency injection
 */
export class RegistryFactory {
  private readonly container: DIContainer;
  private initialized: boolean = false;

  constructor(container: DIContainer) {
    this.container = container;
  }

  /**
   * Initialize registry services and register them with the DI container
   */
  async initialize(config: RegistryFactoryConfig = {}): Promise<void> {
    if (this.initialized) {
      throw new Error('RegistryFactory has already been initialized');
    }

    // Register configuration
    this.container.register(
      REGISTRY_TOKENS.REGISTRY_CONFIG,
      () => this.createRegistryConfig(config.registryConfig),
      true
    );

    // Register logger
    this.container.register(
      REGISTRY_TOKENS.REGISTRY_LOGGER,
      () => this.createLogger(config.loggerConfig),
      true
    );

    // Register version manager
    this.container.register(
      REGISTRY_TOKENS.VERSION_MANAGER,
      () => this.createVersionManager(),
      true
    );

    // Register registry validator
    if (config.enableValidation !== false) {
      this.container.register(
        REGISTRY_TOKENS.REGISTRY_VALIDATOR,
        () => this.createRegistryValidator(),
        true
      );
    }

    // Register discovery service
    if (config.enableDiscovery !== false) {
      this.container.register(
        REGISTRY_TOKENS.DISCOVERY_SERVICE,
        () => this.createDiscoveryService(),
        true
      );
    }

    // Register main registry
    this.container.register(
      REGISTRY_TOKENS.TOOL_AND_PROMPT_REGISTRY,
      () => this.createToolAndPromptRegistry(),
      true
    );

    this.initialized = true;
  }

  /**
   * Create a configured tool and prompt registry
   */
  createToolAndPromptRegistry(): ToolAndPromptRegistry {
    const config = this.container.has(REGISTRY_TOKENS.REGISTRY_CONFIG)
      ? this.container.resolve<RegistryConfig>(REGISTRY_TOKENS.REGISTRY_CONFIG)
      : this.createRegistryConfig();

    const logger = this.container.has(REGISTRY_TOKENS.REGISTRY_LOGGER)
      ? this.container.resolve<winston.Logger>(REGISTRY_TOKENS.REGISTRY_LOGGER)
      : this.createLogger();

    return new ToolAndPromptRegistry(config, logger);
  }

  /**
   * Create a registry validator
   */
  createRegistryValidator(): RegistryValidator {
    return new RegistryValidator();
  }

  /**
   * Create a version manager
   */
  createVersionManager(): VersionManager {
    return new VersionManager();
  }

  /**
   * Create a discovery service
   */
  createDiscoveryService(): DiscoveryService {
    const versionManager = this.container.has(REGISTRY_TOKENS.VERSION_MANAGER)
      ? this.container.resolve<VersionManager>(REGISTRY_TOKENS.VERSION_MANAGER)
      : this.createVersionManager();

    return new DiscoveryService(versionManager);
  }

  /**
   * Create registry configuration
   */
  createRegistryConfig(partial: Partial<RegistryConfig> = {}): RegistryConfig {
    return {
      validateOnRegister: true,
      allowDuplicateNames: false,
      enforceVersioning: true,
      maxRetries: 3,
      enableLogging: true,
      namePrefix: 'marketing_post_generator_mcp__',
      ...partial,
    };
  }

  /**
   * Create logger configuration
   */
  createLogger(options: winston.LoggerOptions = {}): winston.Logger {
    const defaultOptions: winston.LoggerOptions = {
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
        }),
      ],
    };

    return winston.createLogger({
      ...defaultOptions,
      ...options,
    });
  }

  /**
   * Get the main registry instance
   */
  getRegistry(): ToolAndPromptRegistry {
    if (!this.initialized) {
      throw new Error('RegistryFactory must be initialized before use');
    }

    return this.container.resolve<ToolAndPromptRegistry>(REGISTRY_TOKENS.TOOL_AND_PROMPT_REGISTRY);
  }

  /**
   * Get the registry validator
   */
  getValidator(): RegistryValidator {
    if (!this.initialized) {
      throw new Error('RegistryFactory must be initialized before use');
    }

    if (!this.container.has(REGISTRY_TOKENS.REGISTRY_VALIDATOR)) {
      throw new Error('Registry validator is not enabled');
    }

    return this.container.resolve<RegistryValidator>(REGISTRY_TOKENS.REGISTRY_VALIDATOR);
  }

  /**
   * Get the version manager
   */
  getVersionManager(): VersionManager {
    if (!this.initialized) {
      throw new Error('RegistryFactory must be initialized before use');
    }

    return this.container.resolve<VersionManager>(REGISTRY_TOKENS.VERSION_MANAGER);
  }

  /**
   * Get the discovery service
   */
  getDiscoveryService(): DiscoveryService {
    if (!this.initialized) {
      throw new Error('RegistryFactory must be initialized before use');
    }

    if (!this.container.has(REGISTRY_TOKENS.DISCOVERY_SERVICE)) {
      throw new Error('Discovery service is not enabled');
    }

    return this.container.resolve<DiscoveryService>(REGISTRY_TOKENS.DISCOVERY_SERVICE);
  }

  /**
   * Check if the factory has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset the factory (useful for testing)
   */
  reset(): void {
    // Remove registry-related services from container
    Object.values(REGISTRY_TOKENS).forEach((token) => {
      if (this.container.has(token)) {
        // Note: DIContainer doesn't have a remove method, so we'll just mark as uninitialized
        // In a real implementation, we might want to add a remove method to DIContainer
      }
    });

    this.initialized = false;
  }

  /**
   * Create a registry factory with default configuration
   */
  static async createDefault(container: DIContainer): Promise<RegistryFactory> {
    const factory = new RegistryFactory(container);
    await factory.initialize();
    return factory;
  }

  /**
   * Create a registry factory with custom configuration
   */
  static async createWithConfig(
    container: DIContainer,
    config: RegistryFactoryConfig
  ): Promise<RegistryFactory> {
    const factory = new RegistryFactory(container);
    await factory.initialize(config);
    return factory;
  }

  /**
   * Create a minimal registry for testing
   */
  static async createForTesting(container: DIContainer): Promise<RegistryFactory> {
    const factory = new RegistryFactory(container);
    await factory.initialize({
      registryConfig: {
        enableLogging: false,
        validateOnRegister: false,
      },
      enableValidation: false,
      enableDiscovery: false,
    });
    return factory;
  }

  /**
   * Validate registry configuration
   */
  private validateConfig(config: RegistryFactoryConfig): void {
    if (config.registryConfig?.maxRetries && config.registryConfig.maxRetries < 0) {
      throw new Error('maxRetries must be non-negative');
    }

    if (config.registryConfig?.namePrefix && config.registryConfig.namePrefix.trim().length === 0) {
      throw new Error('namePrefix cannot be empty string');
    }
  }

  /**
   * Setup migration handlers if versioning is enabled
   */
  private setupMigrationHandlers(): void {
    if (!this.container.has(REGISTRY_TOKENS.VERSION_MANAGER)) {
      return;
    }

    const versionManager = this.container.resolve<VersionManager>(REGISTRY_TOKENS.VERSION_MANAGER);

    // Register default migration handlers
    versionManager.registerMigrationHandler('1.0.0', '1.1.0', async (entry) => {
      // Example migration: add new fields or update structure
      return {
        ...entry,
        updatedAt: new Date(),
      };
    });

    // Add more migration handlers as needed
  }
}
