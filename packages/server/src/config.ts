/**
 * Server Configuration Module
 *
 * Reads and validates all server environment variables with sensible defaults.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerConfig {
  port: number;
  dbPath: string;
  ideationDbPath: string;
  forgeDbPath: string;
  mullMemoryDir: string;
  cultivate: CultivateConfig;
}

export interface CultivateConfig {
  dbPath: string;
  secret: string; // Required, no default
  redisUrl: string;
  extractModel?: string;
  clusterModel?: string;
}

/**
 * Get server configuration from environment variables with sensible defaults.
 * Throws an error if CULTIVATE_SECRET is not provided.
 */
export function getServerConfig(): ServerConfig {
  // Validate required env vars
  const cultivateSecret = process.env.CULTIVATE_SECRET;
  if (!cultivateSecret) {
    throw new Error(
      'CULTIVATE_SECRET environment variable is required but not provided. ' +
      'It is needed for auth encryption and has no default value.'
    );
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../../planner.db');
  const ideationDbPath = process.env.IDEATION_DB_PATH || path.resolve(__dirname, '../../../ideation.db');
  const forgeDbPath = process.env.FORGE_DB_PATH || path.resolve(__dirname, '../../../forge.db');
  const mullMemoryDir = process.env.MULL_MEMORY_DIR || path.resolve(__dirname, '../../../memory');

  const cultivateDbPath = process.env.CULTIVATE_DB_PATH || './cultivate.db';
  const cultivateRedisUrl = process.env.CULTIVATE_REDIS_URL || 'redis://localhost:6379';
  const cultivateExtractModel = process.env.CULTIVATE_EXTRACT_MODEL;
  const cultivateClusterModel = process.env.CULTIVATE_CLUSTER_MODEL;

  return {
    port,
    dbPath,
    ideationDbPath,
    forgeDbPath,
    mullMemoryDir,
    cultivate: {
      dbPath: cultivateDbPath,
      secret: cultivateSecret,
      redisUrl: cultivateRedisUrl,
      extractModel: cultivateExtractModel,
      clusterModel: cultivateClusterModel,
    },
  };
}
