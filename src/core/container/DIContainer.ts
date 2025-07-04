// Dependency Injection Container for the Marketing Post Generator MCP

export class DIContainer {
  private readonly services = new Map<string, unknown>();
  private readonly factories = new Map<string, () => unknown>();
  private readonly singletons = new Set<string>();

  /**
   * Register a service factory with the container
   */
  register<T>(token: string, factory: () => T, singleton = true): void {
    this.factories.set(token, factory);
    if (singleton) {
      this.singletons.add(token);
    }
  }

  /**
   * Resolve a service from the container
   */
  resolve<T>(token: string): T {
    // Return cached instance for singletons
    if (this.singletons.has(token) && this.services.has(token)) {
      return this.services.get(token) as T;
    }

    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`Service not registered: ${token}`);
    }

    const instance = factory();

    // Cache singleton instances
    if (this.singletons.has(token)) {
      this.services.set(token, instance);
    }

    return instance as T;
  }

  /**
   * Check if a service is registered
   */
  has(token: string): boolean {
    return this.factories.has(token);
  }

  /**
   * Clear all services and factories
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
  }

  /**
   * Get all registered service tokens
   */
  getRegisteredTokens(): string[] {
    return Array.from(this.factories.keys());
  }
}
