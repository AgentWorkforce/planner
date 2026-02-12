import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MullConfigSchema, type MullConfig } from '../domain/types.js';

const DEFAULTS: MullConfig = {
  memoryDir: './memory',
  mullDir: '.mull',
  adapters: [{ type: 'trajectory', dir: '.trajectories/' }],
};

/**
 * Try to read and parse a JSON file. Returns null if the file doesn't exist.
 * Throws on malformed JSON (that's a real error, not a fallback case).
 */
function readJsonFile(filePath: string): unknown | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Read mull.config.json from the given directory.
 * Returns a partial MullConfig or null if the file doesn't exist.
 */
function readMullConfigFile(cwd: string): Partial<MullConfig> | null {
  const data = readJsonFile(join(cwd, 'mull.config.json'));
  if (data === null) return null;
  if (typeof data !== 'object' || data === null) {
    throw new Error('mull.config.json must contain a JSON object');
  }
  return data as Partial<MullConfig>;
}

/**
 * Read the "mull" key from package.json in the given directory.
 * Returns a partial MullConfig or null if the file/key doesn't exist.
 */
function readPackageJsonMullKey(cwd: string): Partial<MullConfig> | null {
  const data = readJsonFile(join(cwd, 'package.json'));
  if (data === null) return null;
  if (typeof data !== 'object' || data === null) return null;
  const pkg = data as Record<string, unknown>;
  if (!pkg.mull || typeof pkg.mull !== 'object') return null;
  return pkg.mull as Partial<MullConfig>;
}

/**
 * Merge two partial configs. Later source wins for scalar fields.
 * Adapters array replaces entirely (atomic — not element-merged).
 */
function mergePartials(
  base: Partial<MullConfig>,
  override: Partial<MullConfig>,
): Partial<MullConfig> {
  const merged: Partial<MullConfig> = { ...base };

  if (override.memoryDir !== undefined) merged.memoryDir = override.memoryDir;
  if (override.mullDir !== undefined) merged.mullDir = override.mullDir;
  if (override.adapters !== undefined) merged.adapters = override.adapters;

  return merged;
}

/**
 * Resolve a complete MullConfig by merging configuration from multiple sources.
 *
 * Resolution order (highest precedence first):
 *   1. Explicit overrides (opts parameter)
 *   2. mull.config.json in cwd
 *   3. package.json "mull" key in cwd
 *   4. Defaults
 *
 * File-not-found is silently skipped (continue to next source).
 * Malformed JSON in an existing file throws an error.
 *
 * @param opts - Explicit config overrides (highest precedence)
 * @param cwd  - Working directory to search for config files (defaults to process.cwd())
 */
export function resolveConfig(
  opts?: Partial<MullConfig>,
  cwd: string = process.cwd(),
): MullConfig {
  // Read file-based sources (lowest to highest precedence)
  const fromPackageJson = readPackageJsonMullKey(cwd);
  const fromConfigFile = readMullConfigFile(cwd);

  // Layer: defaults → package.json → mull.config.json → opts
  let result: Partial<MullConfig> = { ...DEFAULTS };

  if (fromPackageJson) {
    result = mergePartials(result, fromPackageJson);
  }
  if (fromConfigFile) {
    result = mergePartials(result, fromConfigFile);
  }
  if (opts) {
    result = mergePartials(result, opts);
  }

  return MullConfigSchema.parse(result);
}
