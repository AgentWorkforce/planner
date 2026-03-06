/**
 * Pipeline orchestrator types
 */

import type {
  NormalizedEvent,
  Greenhouse,
  ScoringFactors,
  ExtractionResult,
} from '../domain/types.js';
import type { CultivateConfig, CultivateStorage, SSEBroadcaster } from '../types.js';
import type { FilterRuleRegistry } from '../filters/rule-registry.js';
import type { ApplyFiltersResult } from '../filters/index.js';

/**
 * Provenance record for a single pipeline step
 * Tracks when a step started, completed, and the outcome
 */
export interface StepProvenance {
  /** Pipeline step name (e.g., 'filter', 'extract', 'score', 'dedup', 'cluster', 'store') */
  step: string;

  /** ISO 8601 timestamp when step started */
  started_at: string;

  /** ISO 8601 timestamp when step completed */
  completed_at: string;

  /** Outcome of the step */
  outcome: 'passed' | 'failed' | 'skipped';

  /** Optional reason for outcome (used for failure/skip reasons) */
  reason?: string;
}

/**
 * Context passed through the pipeline processing stages
 * Accumulates results from each stage
 */
export interface ProcessSignalContext {
  /** Input signal (NormalizedEvent) */
  signal: NormalizedEvent;

  /** Resolved greenhouse for the signal */
  greenhouse: Greenhouse;

  /** Current Cultivate configuration */
  config: CultivateConfig;

  /** Storage instance for persistence */
  storage: CultivateStorage;

  /** SSE broadcaster for real-time events (optional) */
  broadcaster?: SSEBroadcaster;

  /** Filter rule registry for Tier 1 filtering */
  filterRegistry: FilterRuleRegistry;

  /** Accumulated provenance records from all steps */
  provenance: StepProvenance[];

  // ========== Stage Results ==========

  /** Result from filter stage (Tier 0 + 1 + 2) */
  filterResult?: ApplyFiltersResult;

  /** Result from extraction stage */
  extractionResult?: ExtractionResult;

  /** Result from scoring stage */
  scoringResult?: {
    score: number;
    factors: ScoringFactors;
  };

  /** Result from deduplication stage */
  dedupResult?: {
    isDuplicate: boolean;
    existingSignalId?: string;
  };

  /** Result from clustering stage */
  clusterResult?: {
    cluster_id: string;
    isNew: boolean;
  };

  /** ID of the stored signal (after successful storage) */
  storedSignalId?: string;

  /** Intent classification from Tier 2 filter (or 'unclassified' if tier2 disabled) */
  intent?: string;
}
