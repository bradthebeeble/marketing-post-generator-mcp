import {
  DiscoveryEntry,
  DiscoveryMetadata,
  RegistryEntry,
  ToolRegistryEntry,
  PromptRegistryEntry,
  VersionInfo,
} from './types.js';
import { VersionManager } from './VersionManager.js';

/**
 * Query options for filtering discovery results
 */
export interface DiscoveryQuery {
  type?: 'tool' | 'prompt' | 'all';
  tags?: string[];
  author?: string;
  deprecated?: boolean;
  versionRange?: string;
  searchText?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'version' | 'created' | 'updated';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Discovery result with pagination information
 */
export interface DiscoveryResult {
  entries: DiscoveryEntry[];
  metadata: DiscoveryMetadata;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Service for discovering and exploring available tools and prompts
 */
export class DiscoveryService {
  private readonly versionManager: VersionManager;

  constructor(versionManager?: VersionManager) {
    this.versionManager = versionManager || new VersionManager();
  }

  /**
   * Discover tools and prompts based on query criteria
   */
  discover(
    toolEntries: Map<string, ToolRegistryEntry>,
    promptEntries: Map<string, PromptRegistryEntry>,
    query: DiscoveryQuery = {}
  ): DiscoveryResult {
    // Collect all entries based on type filter
    const allEntries: RegistryEntry[] = [];

    if (query.type === 'tool' || query.type === undefined || query.type === 'all') {
      allEntries.push(...Array.from(toolEntries.values()));
    }

    if (query.type === 'prompt' || query.type === undefined || query.type === 'all') {
      allEntries.push(...Array.from(promptEntries.values()));
    }

    // Apply filters
    let filteredEntries = this.applyFilters(allEntries, query);

    // Apply sorting
    filteredEntries = this.applySorting(filteredEntries, query);

    // Calculate pagination
    const total = filteredEntries.length;
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const hasMore = offset + limit < total;

    // Apply pagination
    const paginatedEntries = filteredEntries.slice(offset, offset + limit);

    // Convert to discovery entries
    const discoveryEntries = this.convertToDiscoveryEntries(paginatedEntries);

    // Generate metadata
    const metadata = this.generateDiscoveryMetadata(toolEntries, promptEntries, query);

    return {
      entries: discoveryEntries,
      metadata,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
    };
  }

  /**
   * Search for tools and prompts by text
   */
  search(
    toolEntries: Map<string, ToolRegistryEntry>,
    promptEntries: Map<string, PromptRegistryEntry>,
    searchText: string,
    options: Omit<DiscoveryQuery, 'searchText'> = {}
  ): DiscoveryResult {
    return this.discover(toolEntries, promptEntries, {
      ...options,
      searchText: searchText.toLowerCase(),
    });
  }

  /**
   * Get tools and prompts by specific tags
   */
  getByTags(
    toolEntries: Map<string, ToolRegistryEntry>,
    promptEntries: Map<string, PromptRegistryEntry>,
    tags: string[],
    options: Omit<DiscoveryQuery, 'tags'> = {}
  ): DiscoveryResult {
    return this.discover(toolEntries, promptEntries, {
      ...options,
      tags,
    });
  }

  /**
   * Get tools and prompts by author
   */
  getByAuthor(
    toolEntries: Map<string, ToolRegistryEntry>,
    promptEntries: Map<string, PromptRegistryEntry>,
    author: string,
    options: Omit<DiscoveryQuery, 'author'> = {}
  ): DiscoveryResult {
    return this.discover(toolEntries, promptEntries, {
      ...options,
      author,
    });
  }

  /**
   * Get compatible tools and prompts for a specific version
   */
  getCompatibleEntries(
    toolEntries: Map<string, ToolRegistryEntry>,
    promptEntries: Map<string, PromptRegistryEntry>,
    targetVersion: VersionInfo,
    options: DiscoveryQuery = {}
  ): DiscoveryResult {
    const versionString = this.versionManager.formatVersion(targetVersion);
    return this.discover(toolEntries, promptEntries, {
      ...options,
      versionRange: `^${versionString}`,
    });
  }

  /**
   * Get recently created or updated entries
   */
  getRecent(
    toolEntries: Map<string, ToolRegistryEntry>,
    promptEntries: Map<string, PromptRegistryEntry>,
    days: number = 30,
    options: DiscoveryQuery = {}
  ): DiscoveryResult {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const allEntries: RegistryEntry[] = [
      ...Array.from(toolEntries.values()),
      ...Array.from(promptEntries.values()),
    ];

    const recentEntries = allEntries.filter(
      (entry) => entry.createdAt >= cutoffDate || entry.updatedAt >= cutoffDate
    );

    // Convert to map format for discovery method
    const recentToolEntries = new Map<string, ToolRegistryEntry>();
    const recentPromptEntries = new Map<string, PromptRegistryEntry>();

    recentEntries.forEach((entry) => {
      if (entry.type === 'tool') {
        recentToolEntries.set(entry.name, entry as ToolRegistryEntry);
      } else {
        recentPromptEntries.set(entry.name, entry as PromptRegistryEntry);
      }
    });

    return this.discover(recentToolEntries, recentPromptEntries, {
      ...options,
      sortBy: 'updated',
      sortOrder: 'desc',
    });
  }

  /**
   * Get deprecated entries
   */
  getDeprecated(
    toolEntries: Map<string, ToolRegistryEntry>,
    promptEntries: Map<string, PromptRegistryEntry>,
    options: Omit<DiscoveryQuery, 'deprecated'> = {}
  ): DiscoveryResult {
    return this.discover(toolEntries, promptEntries, {
      ...options,
      deprecated: true,
    });
  }

  /**
   * Get available categories (tags)
   */
  getCategories(
    toolEntries: Map<string, ToolRegistryEntry>,
    promptEntries: Map<string, PromptRegistryEntry>
  ): string[] {
    const categories = new Set<string>();

    // Collect tags from tools
    toolEntries.forEach((tool) => {
      tool.tags?.forEach((tag) => categories.add(tag));
    });

    // Collect tags from prompts
    promptEntries.forEach((prompt) => {
      prompt.tags?.forEach((tag) => categories.add(tag));
    });

    return Array.from(categories).sort();
  }

  /**
   * Get statistics about available entries
   */
  getStatistics(
    toolEntries: Map<string, ToolRegistryEntry>,
    promptEntries: Map<string, PromptRegistryEntry>
  ): {
    tools: number;
    prompts: number;
    total: number;
    deprecated: number;
    categories: number;
    authors: number;
    averageVersion: string;
    latestVersion: string;
  } {
    const allEntries: RegistryEntry[] = [
      ...Array.from(toolEntries.values()),
      ...Array.from(promptEntries.values()),
    ];

    const authors = new Set<string>();
    const categories = new Set<string>();
    let deprecatedCount = 0;
    const totalVersion = { major: 0, minor: 0, patch: 0 };
    let latestVersion = { major: 0, minor: 0, patch: 0 };

    allEntries.forEach((entry) => {
      if (entry.author) authors.add(entry.author);
      entry.tags?.forEach((tag) => categories.add(tag));
      if (entry.deprecated) deprecatedCount++;

      totalVersion.major += entry.version.major;
      totalVersion.minor += entry.version.minor;
      totalVersion.patch += entry.version.patch;

      if (this.versionManager.compareVersions(entry.version, latestVersion) > 0) {
        latestVersion = entry.version;
      }
    });

    const count = allEntries.length || 1;
    const averageVersion = {
      major: Math.round(totalVersion.major / count),
      minor: Math.round(totalVersion.minor / count),
      patch: Math.round(totalVersion.patch / count),
    };

    return {
      tools: toolEntries.size,
      prompts: promptEntries.size,
      total: allEntries.length,
      deprecated: deprecatedCount,
      categories: categories.size,
      authors: authors.size,
      averageVersion: this.versionManager.formatVersion(averageVersion),
      latestVersion: this.versionManager.formatVersion(latestVersion),
    };
  }

  // Private helper methods

  private applyFilters(entries: RegistryEntry[], query: DiscoveryQuery): RegistryEntry[] {
    return entries.filter((entry) => {
      // Type filter
      if (query.type && query.type !== 'all' && entry.type !== query.type) {
        return false;
      }

      // Tags filter
      if (query.tags && query.tags.length > 0) {
        const entryTags = entry.tags || [];
        const hasMatchingTag = query.tags.some((tag) => entryTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Author filter
      if (query.author && entry.author !== query.author) {
        return false;
      }

      // Deprecated filter
      if (query.deprecated !== undefined && entry.deprecated !== query.deprecated) {
        return false;
      }

      // Version range filter
      if (query.versionRange) {
        try {
          if (!this.versionManager.satisfiesRange(entry.version, query.versionRange)) {
            return false;
          }
        } catch (error) {
          // If version range is invalid, skip this filter
        }
      }

      // Search text filter
      if (query.searchText) {
        const searchText = query.searchText.toLowerCase();
        const matchesName = entry.name.toLowerCase().includes(searchText);
        const matchesDescription = entry.description.toLowerCase().includes(searchText);
        const matchesTags =
          entry.tags?.some((tag) => tag.toLowerCase().includes(searchText)) || false;

        if (!matchesName && !matchesDescription && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }

  private applySorting(entries: RegistryEntry[], query: DiscoveryQuery): RegistryEntry[] {
    const sortBy = query.sortBy || 'name';
    const sortOrder = query.sortOrder || 'asc';

    return entries.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'version':
          comparison = this.versionManager.compareVersions(a.version, b.version);
          break;
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updated':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  private convertToDiscoveryEntries(entries: RegistryEntry[]): DiscoveryEntry[] {
    return entries.map((entry) => {
      const discoveryEntry: DiscoveryEntry = {
        name: entry.name,
        type: entry.type,
        description: entry.description,
        version: this.versionManager.formatVersion(entry.version),
        deprecated: entry.deprecated || false,
        tags: entry.tags || [],
      };

      if (entry.type === 'tool') {
        discoveryEntry.inputSchema = (entry as ToolRegistryEntry).toolDefinition.inputSchema;
      } else {
        discoveryEntry.parameters = (entry as PromptRegistryEntry).promptDefinition.parameters;
      }

      return discoveryEntry;
    });
  }

  private generateDiscoveryMetadata(
    toolEntries: Map<string, ToolRegistryEntry>,
    promptEntries: Map<string, PromptRegistryEntry>,
    query: DiscoveryQuery
  ): DiscoveryMetadata {
    const allEntries: RegistryEntry[] = [
      ...Array.from(toolEntries.values()),
      ...Array.from(promptEntries.values()),
    ];

    const categories = new Set<string>();
    let latestVersion = { major: 0, minor: 0, patch: 0 };

    allEntries.forEach((entry) => {
      entry.tags?.forEach((tag) => categories.add(tag));
      if (this.versionManager.compareVersions(entry.version, latestVersion) > 0) {
        latestVersion = entry.version;
      }
    });

    return {
      totalTools: toolEntries.size,
      totalPrompts: promptEntries.size,
      categories: Array.from(categories),
      latestVersion: this.versionManager.formatVersion(latestVersion),
      serverCapabilities: [
        'tools',
        'prompts',
        'versioning',
        'discovery',
        'search',
        'filtering',
        'pagination',
        'sorting',
      ],
    };
  }
}
