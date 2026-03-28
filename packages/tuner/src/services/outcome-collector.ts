/**
 * OutcomeCollector Service
 *
 * Ingests task and run outcomes from Forge, stores them, and triggers
 * async downstream processing (baseline updates, model learning, drift detection).
 */

import { EventEmitter } from 'events';
import type { TaskOutcome, RunOutcome, IdeationOutcome, PlanQualitySignal } from '../domain/outcome.js';
import type { TunerStorage } from '../storage/interface.js';

/**
 * Events emitted by OutcomeCollector for downstream processing.
 */
export interface OutcomeCollectorEvents {
  task_outcome_received: (outcome: TaskOutcome) => void;
  run_outcome_received: (outcome: RunOutcome) => void;
  ideation_outcome_received: (outcome: IdeationOutcome) => void;
  plan_quality_signal_received: (signal: PlanQualitySignal) => void;
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

  /**
   * Record an ideation outcome.
   * Stores immediately, then emits event for async processing.
   *
   * @returns { received: true } immediately (fire-and-forget pattern)
   */
  recordIdeationOutcome(outcome: IdeationOutcome): { received: true } {
    // Store outcome synchronously
    this.storage.insertIdeationOutcome(outcome);

    // Emit event for async processing (non-blocking)
    setImmediate(() => {
      this.emit('ideation_outcome_received', outcome);
    });

    return { received: true };
  }

  /**
   * Record a plan quality signal.
   * Stores immediately, then emits event for async processing.
   *
   * @returns { received: true } immediately
   */
  recordPlanQualitySignal(signal: PlanQualitySignal): { received: true } {
    // Store outcome synchronously
    this.storage.insertPlanQualitySignal(signal);

    // Emit event for async processing
    setImmediate(() => {
      this.emit('plan_quality_signal_received', signal);
    });

    return { received: true };
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
