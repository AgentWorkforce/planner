import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveConfig } from './resolve.js';

describe('resolveConfig()', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mull-config-test-'));
  });

  // -----------------------------------------------------------------------
  // Defaults
  // -----------------------------------------------------------------------

  describe('defaults', () => {
    it('returns defaults when no opts and no config files exist', () => {
      const config = resolveConfig(undefined, tempDir);

      expect(config.memoryDir).toBe('./memory');
      expect(config.mullDir).toBe('.mull');
      expect(config.adapters).toEqual([{ type: 'trajectory', dir: '.trajectories/' }]);
    });

    it('returns defaults when called with empty opts', () => {
      const config = resolveConfig({}, tempDir);

      expect(config.memoryDir).toBe('./memory');
      expect(config.mullDir).toBe('.mull');
      expect(config.adapters).toEqual([{ type: 'trajectory', dir: '.trajectories/' }]);
    });
  });

  // -----------------------------------------------------------------------
  // package.json "mull" key
  // -----------------------------------------------------------------------

  describe('package.json mull key', () => {
    it('reads mull config from package.json', () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          mull: { memoryDir: './pkg-memory' },
        }),
      );

      const config = resolveConfig(undefined, tempDir);

      expect(config.memoryDir).toBe('./pkg-memory');
      expect(config.mullDir).toBe('.mull'); // default preserved
    });

    it('ignores package.json without mull key', () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project' }),
      );

      const config = resolveConfig(undefined, tempDir);

      expect(config.memoryDir).toBe('./memory');
    });

    it('ignores package.json when mull key is not an object', () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', mull: 'not-an-object' }),
      );

      const config = resolveConfig(undefined, tempDir);

      expect(config.memoryDir).toBe('./memory');
    });
  });

  // -----------------------------------------------------------------------
  // mull.config.json
  // -----------------------------------------------------------------------

  describe('mull.config.json', () => {
    it('reads config from mull.config.json', () => {
      writeFileSync(
        join(tempDir, 'mull.config.json'),
        JSON.stringify({ memoryDir: './custom-memory', mullDir: '.custom-mull' }),
      );

      const config = resolveConfig(undefined, tempDir);

      expect(config.memoryDir).toBe('./custom-memory');
      expect(config.mullDir).toBe('.custom-mull');
    });

    it('reads adapters from mull.config.json', () => {
      writeFileSync(
        join(tempDir, 'mull.config.json'),
        JSON.stringify({
          adapters: [{ type: 'custom', dir: '/data/custom/' }],
        }),
      );

      const config = resolveConfig(undefined, tempDir);

      expect(config.adapters).toEqual([{ type: 'custom', dir: '/data/custom/' }]);
    });

    it('throws on malformed JSON in mull.config.json', () => {
      writeFileSync(join(tempDir, 'mull.config.json'), '{ not valid json }');

      expect(() => resolveConfig(undefined, tempDir)).toThrow();
    });

    it('throws when mull.config.json is not an object', () => {
      writeFileSync(join(tempDir, 'mull.config.json'), '"just a string"');

      expect(() => resolveConfig(undefined, tempDir)).toThrow('mull.config.json must contain a JSON object');
    });
  });

  // -----------------------------------------------------------------------
  // Precedence
  // -----------------------------------------------------------------------

  describe('precedence: opts > mull.config.json > package.json > defaults', () => {
    it('mull.config.json overrides package.json', () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ mull: { memoryDir: './pkg-mem', mullDir: '.pkg-mull' } }),
      );
      writeFileSync(
        join(tempDir, 'mull.config.json'),
        JSON.stringify({ memoryDir: './file-mem' }),
      );

      const config = resolveConfig(undefined, tempDir);

      expect(config.memoryDir).toBe('./file-mem');       // from mull.config.json
      expect(config.mullDir).toBe('.pkg-mull');           // from package.json (not overridden by config file)
    });

    it('opts overrides mull.config.json', () => {
      writeFileSync(
        join(tempDir, 'mull.config.json'),
        JSON.stringify({ memoryDir: './file-mem', mullDir: '.file-mull' }),
      );

      const config = resolveConfig({ memoryDir: './opts-mem' }, tempDir);

      expect(config.memoryDir).toBe('./opts-mem');        // from opts
      expect(config.mullDir).toBe('.file-mull');          // from mull.config.json
    });

    it('opts overrides everything', () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ mull: { memoryDir: './pkg' } }),
      );
      writeFileSync(
        join(tempDir, 'mull.config.json'),
        JSON.stringify({ memoryDir: './file' }),
      );

      const config = resolveConfig({ memoryDir: './opts' }, tempDir);

      expect(config.memoryDir).toBe('./opts');
    });

    it('adapters replace atomically at each precedence level', () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({
          mull: { adapters: [{ type: 'pkg-adapter' }] },
        }),
      );
      writeFileSync(
        join(tempDir, 'mull.config.json'),
        JSON.stringify({
          adapters: [{ type: 'file-adapter', dir: '/data' }],
        }),
      );

      // Without opts: mull.config.json wins
      const config1 = resolveConfig(undefined, tempDir);
      expect(config1.adapters).toEqual([{ type: 'file-adapter', dir: '/data' }]);

      // With opts: opts wins
      const config2 = resolveConfig(
        { adapters: [{ type: 'opts-adapter' }] },
        tempDir,
      );
      expect(config2.adapters).toEqual([{ type: 'opts-adapter' }]);
    });

    it('all three sources combine for different fields', () => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ mull: { mullDir: '.from-pkg' } }),
      );
      writeFileSync(
        join(tempDir, 'mull.config.json'),
        JSON.stringify({ adapters: [{ type: 'from-file' }] }),
      );

      const config = resolveConfig({ memoryDir: './from-opts' }, tempDir);

      expect(config.memoryDir).toBe('./from-opts');       // from opts
      expect(config.mullDir).toBe('.from-pkg');            // from package.json
      expect(config.adapters).toEqual([{ type: 'from-file' }]); // from mull.config.json
    });
  });

  // -----------------------------------------------------------------------
  // Zod validation
  // -----------------------------------------------------------------------

  describe('Zod validation', () => {
    it('validates the resolved config with Zod', () => {
      const config = resolveConfig(undefined, tempDir);

      // Valid config passes — verify structure
      expect(typeof config.memoryDir).toBe('string');
      expect(typeof config.mullDir).toBe('string');
      expect(Array.isArray(config.adapters)).toBe(true);
    });

    it('rejects invalid config from mull.config.json via Zod', () => {
      writeFileSync(
        join(tempDir, 'mull.config.json'),
        JSON.stringify({ memoryDir: 123 }), // should be string
      );

      expect(() => resolveConfig(undefined, tempDir)).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles missing cwd directory gracefully', () => {
      const config = resolveConfig(undefined, join(tempDir, 'nonexistent'));

      expect(config.memoryDir).toBe('./memory');
    });

    it('defaults cwd to process.cwd() when not specified', () => {
      // Just verify it doesn't throw when cwd is omitted
      const config = resolveConfig({});
      expect(config.memoryDir).toBeDefined();
    });
  });
});
