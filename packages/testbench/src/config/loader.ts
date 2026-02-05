import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TestbenchConfigSchema, type TestbenchConfig } from './schema.js';

const CONFIG_FILENAMES = ['testbench.config.ts', 'testbench.config.js', 'testbench.config.json'];

/**
 * Load testbench config from file (if present), env vars, and overrides.
 * Priority: overrides > env vars > config file > defaults
 */
export async function loadConfig(overrides?: Partial<TestbenchConfig>): Promise<TestbenchConfig> {
  const fileConfig = await loadConfigFile();
  const envConfig = loadEnvOverrides();

  return TestbenchConfigSchema.parse({
    ...fileConfig,
    ...envConfig,
    ...overrides,
  });
}

/**
 * Synchronous config loader using only env vars and overrides (no file).
 */
export function loadConfigSync(overrides?: Partial<TestbenchConfig>): TestbenchConfig {
  const envConfig = loadEnvOverrides();
  return TestbenchConfigSchema.parse({ ...envConfig, ...overrides });
}

async function loadConfigFile(): Promise<Partial<TestbenchConfig> | undefined> {
  const cwd = process.cwd();

  for (const filename of CONFIG_FILENAMES) {
    const filepath = resolve(cwd, filename);
    if (!existsSync(filepath)) continue;

    if (filename.endsWith('.json')) {
      const { readFileSync } = await import('node:fs');
      const content = readFileSync(filepath, 'utf-8');
      try {
        return JSON.parse(content) as Partial<TestbenchConfig>;
      } catch {
        throw new Error(`Invalid JSON in config file: ${filepath}`);
      }
    }

    // For .ts/.js files, use dynamic import
    const mod = await import(pathToFileURL(filepath).href);
    return (mod.default ?? mod) as Partial<TestbenchConfig>;
  }

  return undefined;
}

function loadEnvOverrides(): Partial<TestbenchConfig> {
  const overrides: Partial<TestbenchConfig> = {};

  if (process.env.PLANNER_URL) overrides.planner_url = process.env.PLANNER_URL;
  if (process.env.FORGE_URL) overrides.forge_url = process.env.FORGE_URL;
  if (process.env.TUNER_URL) overrides.tuner_url = process.env.TUNER_URL;
  if (process.env.TESTBENCH_TIMEOUT) {
    const timeout = parseInt(process.env.TESTBENCH_TIMEOUT, 10);
    if (!Number.isNaN(timeout) && timeout > 0) {
      overrides.default_timeout_minutes = timeout;
    }
  }
  if (process.env.TESTBENCH_WORKSPACE) overrides.workspace_base = process.env.TESTBENCH_WORKSPACE;
  if (process.env.TESTBENCH_RESULTS_DIR) overrides.results_dir = process.env.TESTBENCH_RESULTS_DIR;

  return overrides;
}
