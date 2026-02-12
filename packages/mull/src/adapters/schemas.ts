/**
 * Zod validation schemas for adapter configurations.
 *
 * Each adapter type has its own config schema validated
 * by the createAdapter factory before instantiation.
 */

import { z } from 'zod';

/** Config for TrajectoryAdapter - reads from planner trajectory_events table. */
export const TrajectoryAdapterConfigSchema = z.object({
  /** Path to the planner SQLite database. */
  dbPath: z.string().min(1, 'dbPath is required'),
});
export type TrajectoryAdapterConfig = z.infer<typeof TrajectoryAdapterConfigSchema>;

/** Config for RelayJsonlAdapter - reads from relay JSONL message logs. */
export const RelayAdapterConfigSchema = z.object({
  /** Path to the relay data directory containing JSONL logs. */
  dataDir: z.string().min(1, 'dataDir is required'),
});
export type RelayAdapterConfig = z.infer<typeof RelayAdapterConfigSchema>;

/** Config for TranscriptAdapter - reads from agent transcript files. */
export const TranscriptAdapterConfigSchema = z.object({
  /** Path to the directory containing transcript files. */
  transcriptsDir: z.string().min(1, 'transcriptsDir is required'),
});
export type TranscriptAdapterConfig = z.infer<typeof TranscriptAdapterConfigSchema>;

/** Config for RelayDaemonAdapter - reads from agent-relay daemon storage. */
export const RelayDaemonAdapterConfigSchema = z.object({
  /** Path to the agent-relay data directory (e.g. '.agent-relay'). */
  dataDir: z.string().min(1, 'dataDir is required'),
  /** Path to the sessions.jsonl file. Defaults to <dataDir>/sessions.jsonl. */
  sessionsFile: z.string().optional(),
});
export type RelayDaemonAdapterConfig = z.infer<typeof RelayDaemonAdapterConfigSchema>;

/** Map of adapter type to its config schema. */
export const adapterConfigSchemas = {
  trajectory: TrajectoryAdapterConfigSchema,
  relay: RelayAdapterConfigSchema,
  'relay-daemon': RelayDaemonAdapterConfigSchema,
  transcript: TranscriptAdapterConfigSchema,
} as const;
