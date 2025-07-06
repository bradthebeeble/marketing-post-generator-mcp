import {
  VersionInfo,
  CompatibilityResult,
  RegistryEntry,
  VersionError,
  RegistryEvent
} from './types.js';

/**
 * Manages versioning for registry entries with semantic versioning support
 */
export class VersionManager {
  private migrationHandlers: Map<string, (entry: RegistryEntry) => Promise<RegistryEntry>> = new Map();
  private compatibilityRules: Map<string, (v1: VersionInfo, v2: VersionInfo) => boolean> = new Map();

  constructor() {
    // Set up default compatibility rules
    this.setupDefaultCompatibilityRules();
  }

  /**
   * Parse version string to VersionInfo object
   */
  parseVersion(versionString: string): VersionInfo {
    const versionPattern = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?$/;
    const match = versionString.match(versionPattern);

    if (!match) {
      throw new VersionError(`Invalid version format: ${versionString}. Expected format: x.y.z or x.y.z-prerelease`);
    }

    const result: VersionInfo = {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10)
    };
    
    if (match[4]) {
      result.prerelease = match[4];
    }
    
    return result;
  }

  /**
   * Format VersionInfo object to version string
   */
  formatVersion(version: VersionInfo): string {
    let versionString = `${version.major}.${version.minor}.${version.patch}`;
    if (version.prerelease) {
      versionString += `-${version.prerelease}`;
    }
    return versionString;
  }

  /**
   * Compare two versions
   * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  compareVersions(v1: VersionInfo, v2: VersionInfo): number {
    // Compare major version
    if (v1.major !== v2.major) {
      return v1.major - v2.major;
    }

    // Compare minor version
    if (v1.minor !== v2.minor) {
      return v1.minor - v2.minor;
    }

    // Compare patch version
    if (v1.patch !== v2.patch) {
      return v1.patch - v2.patch;
    }

    // Compare prerelease
    if (v1.prerelease && v2.prerelease) {
      return v1.prerelease.localeCompare(v2.prerelease);
    } else if (v1.prerelease && !v2.prerelease) {
      return -1; // prerelease is less than release
    } else if (!v1.prerelease && v2.prerelease) {
      return 1; // release is greater than prerelease
    }

    return 0; // versions are equal
  }

  /**
   * Check if a version satisfies a range requirement
   */
  satisfiesRange(version: VersionInfo, range: string): boolean {
    try {
      const rangePattern = /^([~^]?)(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?$/;
      const match = range.match(rangePattern);

      if (!match) {
        throw new VersionError(`Invalid version range: ${range}`);
      }

      const operator = match[1] || '';
      const requiredVersion: VersionInfo = {
        major: parseInt(match[2], 10),
        minor: parseInt(match[3], 10),
        patch: parseInt(match[4], 10),
        prerelease: match[5] || undefined
      };

      switch (operator) {
        case '~': // Compatible within patch version
          return this.isCompatiblePatch(version, requiredVersion);
        case '^': // Compatible within minor version
          return this.isCompatibleMinor(version, requiredVersion);
        default: // Exact version match
          return this.compareVersions(version, requiredVersion) === 0;
      }
    } catch (error) {
      throw new VersionError(`Error checking version range: ${error}`);
    }
  }

  /**
   * Check compatibility between two versions
   */
  checkCompatibility(current: VersionInfo, required: VersionInfo): CompatibilityResult {
    const compatible = this.isCompatible(current, required);
    const migrationRequired = !compatible && this.isMigrationPossible(current, required);

    const result: CompatibilityResult = {
      compatible,
      requiredVersion: required,
      currentVersion: current,
      migrationRequired
    };

    if (migrationRequired) {
      result.migrationPath = this.generateMigrationPath(current, required);
    }

    return result;
  }

  /**
   * Increment version based on change type
   */
  incrementVersion(
    currentVersion: VersionInfo,
    changeType: 'major' | 'minor' | 'patch' | 'prerelease',
    prereleaseIdentifier?: string
  ): VersionInfo {
    const newVersion: VersionInfo = { ...currentVersion };

    switch (changeType) {
      case 'major':
        newVersion.major += 1;
        newVersion.minor = 0;
        newVersion.patch = 0;
        delete newVersion.prerelease;
        break;

      case 'minor':
        newVersion.minor += 1;
        newVersion.patch = 0;
        delete newVersion.prerelease;
        break;

      case 'patch':
        newVersion.patch += 1;
        delete newVersion.prerelease;
        break;

      case 'prerelease':
        if (!prereleaseIdentifier) {
          throw new VersionError('Prerelease identifier is required for prerelease version increment');
        }
        newVersion.prerelease = prereleaseIdentifier;
        break;

      default:
        throw new VersionError(`Invalid change type: ${changeType}`);
    }

    return newVersion;
  }

  /**
   * Register a migration handler for a specific version transition
   */
  registerMigrationHandler(
    fromVersion: string,
    toVersion: string,
    handler: (entry: RegistryEntry) => Promise<RegistryEntry>
  ): void {
    const key = `${fromVersion}->${toVersion}`;
    this.migrationHandlers.set(key, handler);
  }

  /**
   * Execute migration for a registry entry
   */
  async migrateEntry(
    entry: RegistryEntry,
    targetVersion: VersionInfo
  ): Promise<RegistryEntry> {
    const currentVersionString = this.formatVersion(entry.version);
    const targetVersionString = this.formatVersion(targetVersion);
    const migrationKey = `${currentVersionString}->${targetVersionString}`;

    const handler = this.migrationHandlers.get(migrationKey);
    if (!handler) {
      throw new VersionError(`No migration handler found for ${migrationKey}`);
    }

    try {
      const migratedEntry = await handler(entry);
      migratedEntry.version = targetVersion;
      migratedEntry.updatedAt = new Date();
      return migratedEntry;
    } catch (error) {
      throw new VersionError(`Migration failed from ${currentVersionString} to ${targetVersionString}: ${error}`);
    }
  }

  /**
   * Register custom compatibility rule
   */
  registerCompatibilityRule(
    ruleKey: string,
    rule: (v1: VersionInfo, v2: VersionInfo) => boolean
  ): void {
    this.compatibilityRules.set(ruleKey, rule);
  }

  /**
   * Apply custom compatibility rule
   */
  applyCompatibilityRule(ruleKey: string, v1: VersionInfo, v2: VersionInfo): boolean {
    const rule = this.compatibilityRules.get(ruleKey);
    if (!rule) {
      throw new VersionError(`Compatibility rule '${ruleKey}' not found`);
    }
    return rule(v1, v2);
  }

  /**
   * Get the latest version from an array of versions
   */
  getLatestVersion(versions: VersionInfo[]): VersionInfo | null {
    if (versions.length === 0) {
      return null;
    }

    return versions.reduce((latest, current) => {
      return this.compareVersions(current, latest) > 0 ? current : latest;
    });
  }

  /**
   * Filter versions by compatibility with a base version
   */
  getCompatibleVersions(baseVersion: VersionInfo, versions: VersionInfo[]): VersionInfo[] {
    return versions.filter(version => this.isCompatible(version, baseVersion));
  }

  /**
   * Check if version is stable (no prerelease)
   */
  isStableVersion(version: VersionInfo): boolean {
    return !version.prerelease;
  }

  /**
   * Check if version is prerelease
   */
  isPrereleaseVersion(version: VersionInfo): boolean {
    return !!version.prerelease;
  }

  // Private helper methods

  private setupDefaultCompatibilityRules(): void {
    // Backward compatibility rule
    this.compatibilityRules.set('backward', (current, required) => {
      return this.compareVersions(current, required) >= 0;
    });

    // Strict compatibility rule
    this.compatibilityRules.set('strict', (current, required) => {
      return this.compareVersions(current, required) === 0;
    });

    // Semantic compatibility rule
    this.compatibilityRules.set('semantic', (current, required) => {
      return this.isSemanticCompatible(current, required);
    });
  }

  private isCompatible(current: VersionInfo, required: VersionInfo): boolean {
    // Apply semantic versioning compatibility rules
    return this.isSemanticCompatible(current, required);
  }

  private isSemanticCompatible(current: VersionInfo, required: VersionInfo): boolean {
    // Major version must match for compatibility
    if (current.major !== required.major) {
      return false;
    }

    // Current version must be greater than or equal to required
    return this.compareVersions(current, required) >= 0;
  }

  private isCompatiblePatch(version: VersionInfo, required: VersionInfo): boolean {
    return version.major === required.major &&
           version.minor === required.minor &&
           version.patch >= required.patch;
  }

  private isCompatibleMinor(version: VersionInfo, required: VersionInfo): boolean {
    if (version.major !== required.major) {
      return false;
    }

    if (version.minor > required.minor) {
      return true;
    }

    if (version.minor === required.minor) {
      return version.patch >= required.patch;
    }

    return false;
  }

  private isMigrationPossible(current: VersionInfo, required: VersionInfo): boolean {
    // Migration is possible if versions are in the same major version line
    // or if there's a registered migration handler
    const currentVersionString = this.formatVersion(current);
    const requiredVersionString = this.formatVersion(required);
    const migrationKey = `${currentVersionString}->${requiredVersionString}`;

    return this.migrationHandlers.has(migrationKey) ||
           (current.major === required.major && this.compareVersions(current, required) < 0);
  }

  private generateMigrationPath(current: VersionInfo, target: VersionInfo): string[] {
    const path: string[] = [];
    const currentVersionString = this.formatVersion(current);
    const targetVersionString = this.formatVersion(target);

    // Simple migration path - direct migration if possible
    if (this.migrationHandlers.has(`${currentVersionString}->${targetVersionString}`)) {
      path.push(`${currentVersionString}->${targetVersionString}`);
    } else {
      // Multi-step migration would require more complex logic
      path.push(`Complex migration required from ${currentVersionString} to ${targetVersionString}`);
    }

    return path;
  }
}