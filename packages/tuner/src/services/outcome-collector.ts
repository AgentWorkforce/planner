/**
 * OutcomeCollector Service
 *
 * Ingests task and run outcomes from Forge, stores them, and triggers
 * async downstream processing (baseline updates, model learning, drift detection).
 */

import { EventEmitter } from 'events';
import type { TaskOutcome, RunOutcome } from '../domain/outcome.js';
import type { TunerStorage } from '../storage/interface.js';

/**
 * Events emitted by OutcomeCollector for downstream processing.
 */
export interface OutcomeCollectorEvents {
  task_outcome_received: (outcome: TaskOutcome) => void;
  run_outcome_received: (outcome: RunOutcome) => void;
}

/**
 * OutcomeCollector service.
 * Ingests outcomes from Forge and triggers async processing.
 */
export class OutcomeCollector extends EventEmitter {
  constructor(private storage: TunerStorage) {
    super();
  }

  /**
   * Record a task outcome.
   * Stores immediately, then emits event for async downstream processing.
   *
   * @returns { received: true } immediately (fire-and-forget pattern)
   */
  recordTaskOutcome(outcome: TaskOutcome): { received: true } {
    // Store outcome synchronously
    this.storage.insertTaskOutcome(outcome);

    // Emit event for async processing (non-blocking)
    // Downstream services listen for this event
    setImmediate(() => {
      this.emit('task_outcome_received', outcome);
    });

    return { received: true };
  }

  /**
   * Record a run outcome.
   * Stores immediately, then emits event for async processing.
   *
   * @returns { received: true } immediately
   */
  recordRunOutcome(outcome: RunOutcome): { received: true } {
    // Store outcome synchronously
    this.storage.insertRunOutcome(outcome);

    // Emit event for async processing
    setImmediate(() => {
      this.emit('run_outcome_received', outcome);
    });

    return { received: true };
  }

  /**
   * Get all task outcomes for a specific run.
   */
  getTaskOutcomesForRun(runId: string): TaskOutcome[] {
    return this.storage.getTaskOutcomesByRunId(runId);
  }

  /**
   * Get recent task outcomes (for debugging/CLI).
   */
  getRecentOutcomes(limit: number = 10): TaskOutcome[] {
    return this.storage.getRecentTaskOutcomes(limit);
  }

  /**
   * Get total outcome count (for exploration rate calculation).
   */
  getTotalOutcomeCount(): number {
    return this.storage.getTotalOutcomeCount();
  }
}

// Type augmentation for EventEmitter
declare module 'events' {
  interface EventEmitter {
    on<K extends keyof OutcomeCollectorEvents>(
      event: K,
      listener: OutcomeCollectorEvents[K]
    ): this;
    emit<K extends keyof OutcomeCollectorEvents>(
      event: K,
      ...args: Parameters<OutcomeCollectorEvents[K]>
    ): boolean;
  }
}
