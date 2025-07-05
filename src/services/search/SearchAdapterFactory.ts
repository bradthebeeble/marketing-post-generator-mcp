import { ISearchAdapter } from './ISearchAdapter.js';
import { createLogger } from '../../utils/logger.js';
import winston from 'winston';

/**
 * Factory for creating and managing search adapter instances.
 * Provides centralized registration and creation of search adapters.
 */
export class SearchAdapterFactory {
  private static adapters = new Map<string, new () => ISearchAdapter>();
  private static logger: winston.Logger = createLogger({ level: 'info', format: 'simple' });

  /**
   * Register a new adapter implementation
   * @param name Name/identifier for the adapter
   * @param adapterClass Class constructor for the adapter
   */
  public static registerAdapter(name: string, adapterClass: new () => ISearchAdapter): void {
    const normalizedName = name.toLowerCase();
    
    if (this.adapters.has(normalizedName)) {
      this.logger.warn(`Adapter '${name}' is already registered, overwriting`);
    }
    
    this.adapters.set(normalizedName, adapterClass);
    this.logger.info(`Search adapter registered: ${name}`);
  }

  /**
   * Create an instance of a specific adapter
   * @param name Name of the adapter to create
   * @returns New instance of the specified adapter
   * @throws Error if adapter is not found
   */
  public static createAdapter(name: string): ISearchAdapter {
    const normalizedName = name.toLowerCase();
    const AdapterClass = this.adapters.get(normalizedName);
    
    if (!AdapterClass) {
      const availableAdapters = Array.from(this.adapters.keys()).join(', ');
      throw new Error(
        `Search adapter '${name}' not found. Available adapters: ${availableAdapters}`
      );
    }
    
    try {
      const adapter = new AdapterClass();
      this.logger.debug(`Created search adapter instance: ${name}`);
      return adapter;
    } catch (error) {
      this.logger.error(`Failed to create search adapter '${name}'`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to create search adapter '${name}': ${error}`);
    }
  }

  /**
   * List all available adapters
   * @returns Array of registered adapter names
   */
  public static getAvailableAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if an adapter is registered
   * @param name Name of the adapter to check
   * @returns True if the adapter is registered
   */
  public static hasAdapter(name: string): boolean {
    return this.adapters.has(name.toLowerCase());
  }

  /**
   * Unregister an adapter
   * @param name Name of the adapter to unregister
   * @returns True if the adapter was found and removed
   */
  public static unregisterAdapter(name: string): boolean {
    const normalizedName = name.toLowerCase();
    const removed = this.adapters.delete(normalizedName);
    
    if (removed) {
      this.logger.info(`Search adapter unregistered: ${name}`);
    } else {
      this.logger.warn(`Attempted to unregister non-existent adapter: ${name}`);
    }
    
    return removed;
  }

  /**
   * Clear all registered adapters
   */
  public static clearAdapters(): void {
    const count = this.adapters.size;
    this.adapters.clear();
    this.logger.info(`Cleared ${count} registered search adapters`);
  }
}