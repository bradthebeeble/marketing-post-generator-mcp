import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { VersionManager } from '../VersionManager.js';
import { VersionInfo, VersionError, RegistryEntry } from '../types.js';

describe('VersionManager', () => {
  let versionManager: VersionManager;

  beforeEach(() => {
    versionManager = new VersionManager();
  });

  describe('Version Parsing', () => {
    it('should parse valid version strings', () => {
      const testCases = [
        { input: '1.0.0', expected: { major: 1, minor: 0, patch: 0 } },
        { input: '2.5.10', expected: { major: 2, minor: 5, patch: 10 } },
        { input: '1.0.0-alpha', expected: { major: 1, minor: 0, patch: 0, prerelease: 'alpha' } },
        { input: '1.0.0-beta.1', expected: { major: 1, minor: 0, patch: 0, prerelease: 'beta.1' } },
        { input: '1.0.0-rc.1.2', expected: { major: 1, minor: 0, patch: 0, prerelease: 'rc.1.2' } }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = versionManager.parseVersion(input);
        expect(result).toEqual(expected);
      });
    });

    it('should reject invalid version strings', () => {
      const invalidVersions = [
        '1.0',
        '1.0.0.0',
        'v1.0.0',
        '1.0.0-',
        '1.0.0-@invalid',
        'invalid',
        '',
        '1.0.0-alpha@beta'
      ];

      invalidVersions.forEach(invalid => {
        expect(() => versionManager.parseVersion(invalid)).toThrow(VersionError);
      });
    });
  });

  describe('Version Formatting', () => {
    it('should format version objects to strings', () => {
      const testCases = [
        { input: { major: 1, minor: 0, patch: 0 }, expected: '1.0.0' },
        { input: { major: 2, minor: 5, patch: 10 }, expected: '2.5.10' },
        { input: { major: 1, minor: 0, patch: 0, prerelease: 'alpha' }, expected: '1.0.0-alpha' },
        { input: { major: 1, minor: 0, patch: 0, prerelease: 'beta.1' }, expected: '1.0.0-beta.1' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = versionManager.formatVersion(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Version Comparison', () => {
    it('should compare major versions correctly', () => {
      const v1 = { major: 1, minor: 0, patch: 0 };
      const v2 = { major: 2, minor: 0, patch: 0 };

      expect(versionManager.compareVersions(v1, v2)).toBe(-1);
      expect(versionManager.compareVersions(v2, v1)).toBe(1);
      expect(versionManager.compareVersions(v1, v1)).toBe(0);
    });

    it('should compare minor versions correctly', () => {
      const v1 = { major: 1, minor: 0, patch: 0 };
      const v2 = { major: 1, minor: 1, patch: 0 };

      expect(versionManager.compareVersions(v1, v2)).toBe(-1);
      expect(versionManager.compareVersions(v2, v1)).toBe(1);
    });

    it('should compare patch versions correctly', () => {
      const v1 = { major: 1, minor: 0, patch: 0 };
      const v2 = { major: 1, minor: 0, patch: 1 };

      expect(versionManager.compareVersions(v1, v2)).toBe(-1);
      expect(versionManager.compareVersions(v2, v1)).toBe(1);
    });

    it('should handle prerelease versions correctly', () => {
      const v1 = { major: 1, minor: 0, patch: 0, prerelease: 'alpha' };
      const v2 = { major: 1, minor: 0, patch: 0 };
      const v3 = { major: 1, minor: 0, patch: 0, prerelease: 'beta' };

      expect(versionManager.compareVersions(v1, v2)).toBe(-1); // prerelease < release
      expect(versionManager.compareVersions(v2, v1)).toBe(1);
      expect(versionManager.compareVersions(v1, v3)).toBe(-1); // alpha < beta
    });
  });

  describe('Version Range Satisfaction', () => {
    it('should check exact version matches', () => {
      const version = { major: 1, minor: 2, patch: 3 };
      
      expect(versionManager.satisfiesRange(version, '1.2.3')).toBe(true);
      expect(versionManager.satisfiesRange(version, '1.2.4')).toBe(false);
    });

    it('should check tilde ranges (patch-level compatibility)', () => {
      const version = { major: 1, minor: 2, patch: 5 };
      
      expect(versionManager.satisfiesRange(version, '~1.2.3')).toBe(true);
      expect(versionManager.satisfiesRange(version, '~1.2.6')).toBe(false);
      expect(versionManager.satisfiesRange(version, '~1.3.0')).toBe(false);
    });

    it('should check caret ranges (minor-level compatibility)', () => {
      const version = { major: 1, minor: 2, patch: 5 };
      
      expect(versionManager.satisfiesRange(version, '^1.2.3')).toBe(true);
      expect(versionManager.satisfiesRange(version, '^1.1.0')).toBe(true);
      expect(versionManager.satisfiesRange(version, '^1.3.0')).toBe(false);
      expect(versionManager.satisfiesRange(version, '^2.0.0')).toBe(false);
    });

    it('should handle invalid version ranges', () => {
      const version = { major: 1, minor: 0, patch: 0 };
      
      expect(() => versionManager.satisfiesRange(version, 'invalid-range')).toThrow(VersionError);
    });
  });

  describe('Compatibility Checking', () => {
    it('should check semantic compatibility', () => {
      const current = { major: 1, minor: 2, patch: 3 };
      const required = { major: 1, minor: 1, patch: 0 };

      const result = versionManager.checkCompatibility(current, required);
      expect(result.compatible).toBe(true);
      expect(result.migrationRequired).toBe(false);
    });

    it('should detect incompatible major versions', () => {
      const current = { major: 1, minor: 0, patch: 0 };
      const required = { major: 2, minor: 0, patch: 0 };

      const result = versionManager.checkCompatibility(current, required);
      expect(result.compatible).toBe(false);
    });

    it('should detect when current version is too old', () => {
      const current = { major: 1, minor: 0, patch: 0 };
      const required = { major: 1, minor: 1, patch: 0 };

      const result = versionManager.checkCompatibility(current, required);
      expect(result.compatible).toBe(false);
      expect(result.migrationRequired).toBe(true);
    });
  });

  describe('Version Incrementing', () => {
    it('should increment major version', () => {
      const version = { major: 1, minor: 2, patch: 3, prerelease: 'alpha' };
      const result = versionManager.incrementVersion(version, 'major');

      expect(result).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: undefined
      });
    });

    it('should increment minor version', () => {
      const version = { major: 1, minor: 2, patch: 3, prerelease: 'alpha' };
      const result = versionManager.incrementVersion(version, 'minor');

      expect(result).toEqual({
        major: 1,
        minor: 3,
        patch: 0,
        prerelease: undefined
      });
    });

    it('should increment patch version', () => {
      const version = { major: 1, minor: 2, patch: 3, prerelease: 'alpha' };
      const result = versionManager.incrementVersion(version, 'patch');

      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 4,
        prerelease: undefined
      });
    });

    it('should add prerelease version', () => {
      const version = { major: 1, minor: 2, patch: 3 };
      const result = versionManager.incrementVersion(version, 'prerelease', 'beta.1');

      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: 'beta.1'
      });
    });

    it('should require prerelease identifier for prerelease increment', () => {
      const version = { major: 1, minor: 0, patch: 0 };
      
      expect(() => versionManager.incrementVersion(version, 'prerelease')).toThrow(VersionError);
    });

    it('should reject invalid change types', () => {
      const version = { major: 1, minor: 0, patch: 0 };
      
      expect(() => versionManager.incrementVersion(version, 'invalid' as any)).toThrow(VersionError);
    });
  });

  describe('Migration Handling', () => {
    it('should register migration handlers', () => {
      const handler = jest.fn().mockResolvedValue({} as RegistryEntry);
      
      versionManager.registerMigrationHandler('1.0.0', '1.1.0', handler);
      
      // Should not throw - indicates successful registration
      expect(() => versionManager.registerMigrationHandler('1.1.0', '1.2.0', handler)).not.toThrow();
    });

    it('should execute migration with registered handler', async () => {
      const mockEntry: RegistryEntry = {
        type: 'tool',
        id: 'test',
        name: 'test',
        description: 'test',
        version: { major: 1, minor: 0, patch: 0 },
        toolDefinition: {} as any,
        handler: async () => 'result',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const migrationHandler = jest.fn().mockResolvedValue({
        ...mockEntry,
        description: 'migrated'
      });

      versionManager.registerMigrationHandler('1.0.0', '1.1.0', migrationHandler);

      const targetVersion = { major: 1, minor: 1, patch: 0 };
      const result = await versionManager.migrateEntry(mockEntry, targetVersion);

      expect(migrationHandler).toHaveBeenCalledWith(mockEntry);
      expect(result.version).toEqual(targetVersion);
      expect(result.description).toBe('migrated');
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw error when no migration handler exists', async () => {
      const mockEntry: RegistryEntry = {
        type: 'tool',
        id: 'test',
        name: 'test',
        description: 'test',
        version: { major: 1, minor: 0, patch: 0 },
        toolDefinition: {} as any,
        handler: async () => 'result',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const targetVersion = { major: 2, minor: 0, patch: 0 };

      await expect(
        versionManager.migrateEntry(mockEntry, targetVersion)
      ).rejects.toThrow('No migration handler found');
    });

    it('should handle migration handler errors', async () => {
      const mockEntry: RegistryEntry = {
        type: 'tool',
        id: 'test',
        name: 'test',
        description: 'test',
        version: { major: 1, minor: 0, patch: 0 },
        toolDefinition: {} as any,
        handler: async () => 'result',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const failingHandler = jest.fn().mockRejectedValue(new Error('Migration failed'));
      versionManager.registerMigrationHandler('1.0.0', '1.1.0', failingHandler);

      const targetVersion = { major: 1, minor: 1, patch: 0 };

      await expect(
        versionManager.migrateEntry(mockEntry, targetVersion)
      ).rejects.toThrow('Migration failed');
    });
  });

  describe('Compatibility Rules', () => {
    it('should register custom compatibility rules', () => {
      const rule = jest.fn().mockReturnValue(true);
      
      versionManager.registerCompatibilityRule('custom', rule);
      
      const result = versionManager.applyCompatibilityRule(
        'custom',
        { major: 1, minor: 0, patch: 0 },
        { major: 1, minor: 1, patch: 0 }
      );

      expect(result).toBe(true);
      expect(rule).toHaveBeenCalled();
    });

    it('should throw error for unknown compatibility rules', () => {
      expect(() => 
        versionManager.applyCompatibilityRule(
          'unknown',
          { major: 1, minor: 0, patch: 0 },
          { major: 1, minor: 1, patch: 0 }
        )
      ).toThrow('not found');
    });

    it('should apply backward compatibility rule', () => {
      const v1 = { major: 1, minor: 2, patch: 0 };
      const v2 = { major: 1, minor: 1, patch: 0 };

      expect(versionManager.applyCompatibilityRule('backward', v1, v2)).toBe(true);
      expect(versionManager.applyCompatibilityRule('backward', v2, v1)).toBe(false);
    });

    it('should apply strict compatibility rule', () => {
      const v1 = { major: 1, minor: 0, patch: 0 };
      const v2 = { major: 1, minor: 0, patch: 0 };
      const v3 = { major: 1, minor: 0, patch: 1 };

      expect(versionManager.applyCompatibilityRule('strict', v1, v2)).toBe(true);
      expect(versionManager.applyCompatibilityRule('strict', v1, v3)).toBe(false);
    });
  });

  describe('Version Utilities', () => {
    it('should find latest version from array', () => {
      const versions = [
        { major: 1, minor: 0, patch: 0 },
        { major: 1, minor: 2, patch: 0 },
        { major: 1, minor: 1, patch: 5 },
        { major: 2, minor: 0, patch: 0 }
      ];

      const latest = versionManager.getLatestVersion(versions);
      expect(latest).toEqual({ major: 2, minor: 0, patch: 0 });
    });

    it('should return null for empty version array', () => {
      const latest = versionManager.getLatestVersion([]);
      expect(latest).toBeNull();
    });

    it('should filter compatible versions', () => {
      const baseVersion = { major: 1, minor: 2, patch: 0 };
      const versions = [
        { major: 1, minor: 1, patch: 0 },
        { major: 1, minor: 2, patch: 0 },
        { major: 1, minor: 3, patch: 0 },
        { major: 2, minor: 0, patch: 0 }
      ];

      const compatible = versionManager.getCompatibleVersions(baseVersion, versions);
      expect(compatible).toHaveLength(2); // 1.2.0 and 1.3.0
      expect(compatible).toContainEqual({ major: 1, minor: 2, patch: 0 });
      expect(compatible).toContainEqual({ major: 1, minor: 3, patch: 0 });
    });

    it('should identify stable versions', () => {
      const stableVersion = { major: 1, minor: 0, patch: 0 };
      const prereleaseVersion = { major: 1, minor: 0, patch: 0, prerelease: 'alpha' };

      expect(versionManager.isStableVersion(stableVersion)).toBe(true);
      expect(versionManager.isStableVersion(prereleaseVersion)).toBe(false);
    });

    it('should identify prerelease versions', () => {
      const stableVersion = { major: 1, minor: 0, patch: 0 };
      const prereleaseVersion = { major: 1, minor: 0, patch: 0, prerelease: 'alpha' };

      expect(versionManager.isPrereleaseVersion(stableVersion)).toBe(false);
      expect(versionManager.isPrereleaseVersion(prereleaseVersion)).toBe(true);
    });
  });
});