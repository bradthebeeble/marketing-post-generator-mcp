import { SearchService } from './SearchService.js';
import { SearchAdapterFactory } from './SearchAdapterFactory.js';
import { ISearchAdapter } from './ISearchAdapter.js';
import { SearchConfig } from './types.js';
import { createLogger } from '../../utils/logger.js';
import winston from 'winston';

/**
 * Factory function to create SearchService from configuration
 */
export async function createSearchService(
  config: SearchConfig,
  logger?: winston.Logger
): Promise<SearchService> {
  const serviceLogger = logger || createLogger({ level: 'info', format: 'simple' });

  serviceLogger.info('Creating SearchService', {
    defaultAdapter: config.defaultAdapter,
    fallbackAdapters: config.fallbackAdapters,
    configuredAdapters: Object.keys(config.adapterConfigs),
  });

  try {
    // Create and initialize primary adapter
    const primaryAdapter = SearchAdapterFactory.createAdapter(config.defaultAdapter);
    const primaryConfig = config.adapterConfigs[config.defaultAdapter] || {};
    await primaryAdapter.initialize(primaryConfig);

    serviceLogger.info('Primary adapter initialized', {
      adapter: config.defaultAdapter,
      config: primaryConfig,
    });

    // Create and initialize fallback adapters
    const fallbackAdapters: ISearchAdapter[] = [];
    for (const adapterName of config.fallbackAdapters) {
      try {
        if (!SearchAdapterFactory.hasAdapter(adapterName)) {
          serviceLogger.warn('Fallback adapter not registered, skipping', {
            adapter: adapterName,
            availableAdapters: SearchAdapterFactory.getAvailableAdapters(),
          });
          continue;
        }

        const adapter = SearchAdapterFactory.createAdapter(adapterName);
        const adapterConfig = config.adapterConfigs[adapterName] || {};
        await adapter.initialize(adapterConfig);
        fallbackAdapters.push(adapter);

        serviceLogger.info('Fallback adapter initialized', {
          adapter: adapterName,
          config: adapterConfig,
        });
      } catch (error) {
        serviceLogger.warn('Failed to initialize fallback adapter', {
          adapter: adapterName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const searchService = new SearchService(primaryAdapter, fallbackAdapters, serviceLogger);

    serviceLogger.info('SearchService created successfully', {
      primaryAdapter: config.defaultAdapter,
      fallbackCount: fallbackAdapters.length,
      totalAdapters: 1 + fallbackAdapters.length,
    });

    return searchService;
  } catch (error) {
    serviceLogger.error('Failed to create SearchService', {
      error: error instanceof Error ? error.message : String(error),
      config,
    });
    throw new Error(
      `Failed to create SearchService: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Register all built-in search adapters
 */
export async function registerBuiltInAdapters(): Promise<void> {
  // Import adapters dynamically to avoid circular dependencies
  const { WebScrapingAdapter } = await import('./adapters/WebScrapingAdapter.js');
  const { FirecrawlSearchAdapter } = await import('./adapters/FirecrawlSearchAdapter.js');

  SearchAdapterFactory.registerAdapter('web-scraping', WebScrapingAdapter);
  SearchAdapterFactory.registerAdapter('firecrawl', FirecrawlSearchAdapter);

  const logger = createLogger({ level: 'info', format: 'simple' });
  logger.info('Built-in search adapters registered', {
    adapters: SearchAdapterFactory.getAvailableAdapters(),
  });
}
