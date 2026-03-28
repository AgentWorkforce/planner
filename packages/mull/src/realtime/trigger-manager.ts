/**
 * TriggerManager — orchestrates real-time mull triggers.
 *
 * Receives events from forge (TrajectoryCapture), planner (decision events),
 * and relay (agent messages). Evaluates whether each event should trigger
 * deterministic extraction or LLM synthesis, and invokes the appropriate
 * pipeline stage.
 *
 * Two layers:
 *   Deterministic: Runs on every high-signal event. Extracts entities/facts
 *     and accumulates them. Cost: $0. Latency: <100ms.
 *   LLM batch: Triggered when 3+ entities accumulate, on decision events,
 *     on a periodic timer (~20min), or when a session ends.
 *
 * Hooks into existing server event infrastructure via the register*() methods.
 * The server plugin calls these during initialization.
 */

import { EventEmitter } from 'events';
import { readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import type { MullAdapter, SessionRef, MullResult } from '../domain/types.js';
import { mull } from '../mull.js';
import type { MullPipelineOptions } from '../mull.js';
import {
  accumulateEntities,
  markLlmRunComplete,
  loadAccumulatorState,
} from './accumulator.js';
import {
  evaluateForgeEvent,
  extractFromPlannerEvent,
  extractFromRelayMessage,
} from './deterministic.js';
import { evaluateLlmTrigger, isTimerExpired } from './llm-batch.js';
import type {
  ForgeTrajectoryEvent,
  PlannerDecisionEvent,
  RelayMessageEvent,
  TriggerConfig,
  TriggerResult,
  AccumulatorState,
} from './types.js';
import {
  HIGH_SIGNAL_FORGE_EVENTS,
  DECISION_EVENT_TYPES,
  SESSION_END_EVENTS,
  TriggerConfigSchema,
} from './types.js';

// ---------------------------------------------------------------------------
// TriggerManager events
// ---------------------------------------------------------------------------

export interface TriggerManagerEvents {
  /** Emitted after a deterministic trigger processes an event. */
  deterministic: (result: TriggerResult) => void;
  /** Emitted after an LLM batch trigger runs mull(). */
  llmBatch: (result: TriggerResult & { mullResult?: MullResult }) => void;
  /** Emitted on trigger errors (non-fatal). */
  error: (error: Error, context: { sessionId: string; layer: string }) => void;
}

// ---------------------------------------------------------------------------
// TriggerManager
// ---------------------------------------------------------------------------

export class TriggerManager extends EventEmitter {
  private config: TriggerConfig;
  private adapters: MullAdapter[];
  private pipelineOpts: Partial<MullPipelineOptions>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeLlmRuns = new Set<string>(); // Prevent concurrent LLM runs per session
  private stopped = false;

  constructor(opts: {
    config?: Partial<TriggerConfig>;
    adapters: MullAdapter[];
    pipelineOpts?: Partial<MullPipelineOptions>;
  }) {
    super();
    this.config = TriggerConfigSchema.parse(opts.config ?? {});
    this.adapters = opts.adapters;
    this.pipelineOpts = opts.pipelineOpts ?? {};

    // Prevent unhandled 'error' from crashing
    this.on('error', (err, context) => {
      console.error(`[mull:trigger] Error in ${context?.layer ?? 'unknown'}:`, err.message);
    });
  }

  // =========================================================================
  // Event handlers — called by server event infrastructure
  // =========================================================================

  /**
   * Handle a forge trajectory event.
   * This is the primary hook: TrajectoryCapture.on('trajectory', handler).
   */
  async onForgeEvent(event: ForgeTrajectoryEvent): Promise<TriggerResult> {
    if (this.stopped) return noTrigger('deterministic', event.run_id, 'manager stopped');

    const sessionId = event.run_id;

    // Check for session end first
    if (SESSION_END_EVENTS.has(event.event_type as never)) {
      return this.handleSessionEnd(sessionId);
    }

    // Deterministic layer: extract entities/facts from high-signal events
    const extracted = evaluateForgeEvent(event, HIGH_SIGNAL_FORGE_EVENTS);
    if (!extracted) {
      return noTrigger('deterministic', sessionId, `event type ${event.event_type} not high-signal`);
    }

    // Accumulate extracted data
    const state = await accumulateEntities(
      this.config.mullDir,
      sessionId,
      extracted.entities,
      extracted.facts,
    );

    const deterministicResult: TriggerResult = {
      layer: 'deterministic',
      sessionId,
      triggered: true,
      reason: `extracted ${extracted.entities.length} entities, ${extracted.facts.length} facts from ${event.event_type}`,
      entitiesExtracted: extracted.entities.length,
      factsExtracted: extracted.facts.length,
    };
    this.emit('deterministic', deterministicResult);

    // Evaluate LLM trigger
    const isDecision = DECISION_EVENT_TYPES.has(event.event_type as never);
    await this.maybeRunLlmBatch(state, sessionId, isDecision, false);

    return deterministicResult;
  }

  /**
   * Handle a planner decision event.
   * Planner decisions are always high-signal.
   */
  async onPlannerEvent(event: PlannerDecisionEvent): Promise<TriggerResult> {
    if (this.stopped) return noTrigger('deterministic', event.plan_id, 'manager stopped');

    const sessionId = event.plan_id;
    const extracted = extractFromPlannerEvent(event);

    const state = await accumulateEntities(
      this.config.mullDir,
      sessionId,
      extracted.entities,
      extracted.facts,
    );

    const deterministicResult: TriggerResult = {
      layer: 'deterministic',
      sessionId,
      triggered: true,
      reason: `planner decision: ${event.type}`,
      entitiesExtracted: extracted.entities.length,
      factsExtracted: extracted.facts.length,
    };
    this.emit('deterministic', deterministicResult);

    // Planner decisions are always decision-type → immediate LLM trigger
    await this.maybeRunLlmBatch(state, sessionId, true, false);

    return deterministicResult;
  }

  /**
   * Handle a relay message event.
   * Most relay messages are low-signal; extraction filters for substantive content.
   */
  async onRelayMessage(event: RelayMessageEvent): Promise<TriggerResult> {
    if (this.stopped) return noTrigger('deterministic', event.to, 'manager stopped');

    // Derive session ID from channel or target
    const sessionId = event.channel ?? event.to;
    if (!sessionId || sessionId === '__system__') {
      return noTrigger('deterministic', 'unknown', 'no session context');
    }

    const extracted = extractFromRelayMessage(event);
    if (extracted.entities.length === 0 && extracted.facts.length === 0) {
      return noTrigger('deterministic', sessionId, 'relay message not substantive');
    }

    const state = await accumulateEntities(
      this.config.mullDir,
      sessionId,
      extracted.entities,
      extracted.facts,
    );

    const deterministicResult: TriggerResult = {
      layer: 'deterministic',
      sessionId,
      triggered: true,
      reason: `relay message from ${event.from}`,
      entitiesExtracted: extracted.entities.length,
      factsExtracted: extracted.facts.length,
    };
    this.emit('deterministic', deterministicResult);

    // Relay messages don't trigger immediate LLM — rely on threshold/timer
    await this.maybeRunLlmBatch(state, sessionId, false, false);

    return deterministicResult;
  }

  // =========================================================================
  // Timer management
  // =========================================================================

  /**
   * Start the periodic timer that checks for sessions needing LLM flush.
   * The timer runs at half the configured interval for responsive detection.
   */
  startTimer(): void {
    if (this.timer) return;
    const checkInterval = Math.max(this.config.llmTimerIntervalMs / 2, 30_000);

    this.timer = setInterval(() => {
      this.checkTimerExpiredSessions().catch(err => {
        this.emit('error', err instanceof Error ? err : new Error(String(err)), {
          sessionId: '*',
          layer: 'timer',
        });
      });
    }, checkInterval);

    // Allow the timer to not prevent process exit
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop the periodic timer and mark the manager as stopped.
   */
  shutdown(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // =========================================================================
  // Internal: LLM batch evaluation and execution
  // =========================================================================

  /**
   * Evaluate and possibly run an LLM batch for a session.
   * Non-blocking: LLM run happens in background with error handling.
   */
  private async maybeRunLlmBatch(
    state: AccumulatorState,
    sessionId: string,
    isDecisionEvent: boolean,
    isSessionEnd: boolean,
  ): Promise<void> {
    const reason = evaluateLlmTrigger(state, this.config, isDecisionEvent, isSessionEnd);
    if (reason === 'none') return;

    // Prevent concurrent LLM runs for the same session
    if (this.activeLlmRuns.has(sessionId)) {
      return;
    }

    this.activeLlmRuns.add(sessionId);
    try {
      const sessionRef = this.resolveSessionRef(sessionId);
      const mullResult = await mull(sessionRef, {
        ...this.pipelineOpts,
        adapters: this.adapters,
      });

      // Clear accumulator on success
      await markLlmRunComplete(this.config.mullDir, sessionId);

      const result: TriggerResult & { mullResult?: MullResult } = {
        layer: 'llm',
        sessionId,
        triggered: true,
        reason,
        mullResult,
      };
      this.emit('llmBatch', result);
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)), {
        sessionId,
        layer: 'llm',
      });
    } finally {
      this.activeLlmRuns.delete(sessionId);
    }
  }

  /**
   * Handle session end: flush any remaining accumulated data.
   */
  private async handleSessionEnd(sessionId: string): Promise<TriggerResult> {
    const state = loadAccumulatorState(this.config.mullDir, sessionId);

    if (state.entitiesSinceLastLlm.length === 0 && state.factsSinceLastLlm.length === 0) {
      return noTrigger('deterministic', sessionId, 'session ended with no pending data');
    }

    await this.maybeRunLlmBatch(state, sessionId, false, true);

    return {
      layer: 'deterministic',
      sessionId,
      triggered: true,
      reason: 'session end — flushing accumulated data',
    };
  }

  /**
   * Check all tracked sessions for timer expiry.
   * Scans the realtime state directory for session state files.
   */
  private async checkTimerExpiredSessions(): Promise<void> {
    const stateDir = resolve(this.config.mullDir, 'realtime');
    let files: string[];
    try {
      files = readdirSync(stateDir).filter(f => f.endsWith('.json'));
    } catch {
      return; // Directory doesn't exist yet — no sessions tracked
    }

    for (const file of files) {
      const sessionId = basename(file, '.json');
      try {
        const state = loadAccumulatorState(this.config.mullDir, sessionId);
        if (isTimerExpired(state, this.config.llmTimerIntervalMs)) {
          await this.maybeRunLlmBatch(state, sessionId, false, false);
        }
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)), {
          sessionId,
          layer: 'timer',
        });
      }
    }
  }

  /**
   * Resolve a session ID string to a typed SessionRef.
   * Uses heuristics based on ID format.
   */
  private resolveSessionRef(sessionId: string): SessionRef {
    // Channel names start with # or contain 'channel'
    if (sessionId.startsWith('#') || sessionId.startsWith('channel-')) {
      return { type: 'channel', id: sessionId };
    }
    // Run IDs from forge are UUIDs associated with run_ prefix pattern
    // Plan IDs from planner are also UUIDs — but forge events use run_id
    // as sessionId, planner events use plan_id. Default to run_id as most
    // real-time triggers come from forge.
    return { type: 'run_id', id: sessionId };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noTrigger(layer: TriggerResult['layer'], sessionId: string, reason: string): TriggerResult {
  return { layer, sessionId, triggered: false, reason };
}
