/**
 * Server-Sent Events stream for real-time forge-next run updates.
 *
 * Delivers three categories of events to the frontend:
 *   1. Relay runner events (step progress, run lifecycle)
 *   2. Gate events (human approval checkpoints)
 *   3. Question events (agent clarification requests)
 *
 * The SSE handler replays existing events first (catch-up semantics), then
 * subscribes to live sources for the duration of the connection. All events
 * are also appended to the forge_events log for durability.
 */

import type { Request, Response } from 'express';
import type { WorkflowRunner, WorkflowEvent } from '@agent-relay/sdk/workflows';
import type { ForgeNextStorage } from '../storage/interface.js';
import type { GateManager } from '../gate-manager.js';
import type { QuestionManager } from '../question-manager.js';
import type { RunMonitor, StepMetricsPayload, RunMetricsPayload, StallWarningPayload, StepRetryContextPayload, StepFailedEnrichedPayload, StepScoredPayload, StepRetriesExhaustedPayload, StepMergeStatusPayload, ContextPressurePayload, ContextBudgetExceededPayload } from '../run-monitor.js';
import type { Gate, Question } from '../types.js';

function routeParam(req: Request, key: string): string | null {
  const v = req.params[key];
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

// ---------------------------------------------------------------------------
// SSE dependency contract
// ---------------------------------------------------------------------------

export interface SseDeps {
  storage: ForgeNextStorage;
  runner: WorkflowRunner;
  gateManager: GateManager;
  questionManager: QuestionManager;
  runMonitor: RunMonitor;
}

// ---------------------------------------------------------------------------
// SSE event payload types (what the frontend receives)
// ---------------------------------------------------------------------------

interface RunStatusEvent {
  type: 'run:status';
  run_id: string;
  status: string;
  error?: string;
}

interface StepStatusEvent {
  type: 'step:status';
  run_id: string;
  step_name: string;
  status: string;
  output?: string;
  error?: string;
  attempt?: number;
}

interface GatePendingEvent {
  type: 'gate:pending';
  run_id: string;
  gate_id: string;
  step_id: string;
  step_name: string;
}

interface GateDecidedEvent {
  type: 'gate:approved' | 'gate:rejected';
  run_id: string;
  gate_id: string;
  step_id: string;
  step_name: string;
  approver: string | null;
  decision_note: string | null;
}

interface QuestionPendingEvent {
  type: 'question:pending';
  run_id: string;
  question_id: string;
  step_id: string;
  question: string;
}

interface QuestionAnsweredEvent {
  type: 'question:answered' | 'question:dismissed';
  run_id: string;
  question_id: string;
  step_id: string;
  answer?: string | null;
}

interface StepMetricsEvent {
  type: 'step:metrics';
  run_id: string;
  step_name: string;
  model: string;
  duration_ms: number;
  estimated_cost_usd: number;
  merge_strategy?: string;
}

interface RunMetricsEvent {
  type: 'run:metrics';
  run_id: string;
  total_cost_usd: number;
  steps_completed: number;
  steps_total: number;
  avg_satisfaction: number;
  max_context_utilization: number;
}

interface StallWarningEvent {
  type: 'stall:warning';
  run_id: string;
  step_name: string;
  elapsed_ms: number;
  threshold_ms: number;
}

interface StepRetryContextEvent {
  type: 'step:retry-context';
  run_id: string;
  step_name: string;
  attempt: number;
  previous_failures: string[];
  total_failure_count: number;
  retry_hints?: string[];
}

interface StepFailedEnrichedEvent {
  type: 'step:failed-enriched';
  run_id: string;
  step_name: string;
  error: string;
  failures: string[];
  attempt: number;
}

interface StepScoredEvent {
  type: 'step:scored';
  run_id: string;
  step_name: string;
  score: number;
  reasoning: string;
  matched_criteria: string[];
  failed_criteria: string[];
}

interface StepRetriesExhaustedEvent {
  type: 'step:retries-exhausted';
  run_id: string;
  step_name: string;
  attempt: number;
  max_retries: number;
  failures: string[];
}

interface StepMergeStatusEvent {
  type: 'step:merge-status';
  run_id: string;
  step_name: string;
  status: string;
  branch?: string;
  target_branch?: string;
  error?: string;
}

interface ContextPressureEvent {
  type: 'context:pressure';
  run_id: string;
  step_name: string;
  model: string;
  estimated_tokens: number;
  budget: number;
  utilization: number;
}

interface ContextBudgetExceededEvent {
  type: 'context:budget-exceeded';
  run_id: string;
  step_name: string;
  model: string;
  estimated_tokens: number;
  budget: number;
  utilization: number;
}

type SsePayload =
  | RunStatusEvent
  | StepStatusEvent
  | GatePendingEvent
  | GateDecidedEvent
  | QuestionPendingEvent
  | QuestionAnsweredEvent
  | StepMetricsEvent
  | RunMetricsEvent
  | StallWarningEvent
  | StepRetryContextEvent
  | StepFailedEnrichedEvent
  | StepScoredEvent
  | StepRetriesExhaustedEvent
  | StepMergeStatusEvent
  | ContextPressureEvent
  | ContextBudgetExceededEvent;

// ---------------------------------------------------------------------------
// SSE utility
// ---------------------------------------------------------------------------

function writeSseEvent(res: Response, payload: SsePayload): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ---------------------------------------------------------------------------
// Map a relay WorkflowEvent to a forge-next SSE payload.
// Returns null for event types that don't need to be forwarded.
// ---------------------------------------------------------------------------

function mapRunnerEvent(event: WorkflowEvent, forgeRunId: string): SsePayload | null {
  switch (event.type) {
    case 'run:started':
      return { type: 'run:status', run_id: forgeRunId, status: 'running' };

    case 'run:completed':
      return { type: 'run:status', run_id: forgeRunId, status: 'completed' };

    case 'run:failed':
      return { type: 'run:status', run_id: forgeRunId, status: 'failed', error: event.error };

    case 'run:cancelled':
      return { type: 'run:status', run_id: forgeRunId, status: 'cancelled' };

    case 'step:started':
      return {
        type: 'step:status',
        run_id: forgeRunId,
        step_name: event.stepName,
        status: 'running',
      };

    case 'step:completed':
      return {
        type: 'step:status',
        run_id: forgeRunId,
        step_name: event.stepName,
        status: 'completed',
        output: event.output,
      };

    case 'step:failed':
      return {
        type: 'step:status',
        run_id: forgeRunId,
        step_name: event.stepName,
        status: 'failed',
        error: event.error,
      };

    case 'step:skipped':
      return {
        type: 'step:status',
        run_id: forgeRunId,
        step_name: event.stepName,
        status: 'skipped',
      };

    case 'step:retrying':
      return {
        type: 'step:status',
        run_id: forgeRunId,
        step_name: event.stepName,
        status: 'retrying',
        attempt: event.attempt,
      };

    // step:nudged and step:force-released are internal runner signals — not
    // meaningful to the UI layer, so we drop them.
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// GET /runs/:id/events — SSE stream
// ---------------------------------------------------------------------------

export function runEventsSSEHandler(deps: SseDeps) {
  return (req: Request, res: Response): void => {
    const runId = routeParam(req, 'id');
    if (!runId) {
      res.status(400).json({ error: 'Run ID is required' });
      return;
    }

    const run = deps.storage.getRun(runId);
    if (!run) {
      res.status(404).json({ error: `Run not found: ${runId}` });
      return;
    }

    // SSE headers — disable Express compression for this route
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx: disable buffering
    });

    // Flush headers immediately (important for SSE over HTTP/1.1)
    res.flushHeaders?.();

    // ---------------------------------------------------------------------------
    // Catch-up: replay events already persisted for this run
    // ---------------------------------------------------------------------------
    const existingEvents = deps.storage.listEventsByRun(runId);
    for (const event of existingEvents) {
      try {
        const payload = JSON.parse(event.payload) as SsePayload;
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // Corrupted event entry — skip
      }
    }

    // ---------------------------------------------------------------------------
    // Helper: append event to storage and write to SSE stream
    // ---------------------------------------------------------------------------
    const emitAndPersist = (payload: SsePayload): void => {
      const now = new Date().toISOString();
      deps.storage.appendEvent({
        run_id: runId,
        event_type: payload.type,
        payload: JSON.stringify(payload),
        created_at: now,
      });
      writeSseEvent(res, payload);
    };

    // ---------------------------------------------------------------------------
    // Subscribe: relay runner events
    //
    // The relay runner emits events with its own internal run ID (event.runId).
    // We look up the forge run to confirm this relay run ID matches. Because the
    // runner is a singleton, events from OTHER relay runs (e.g. a concurrent test)
    // must be filtered. We do this by comparing event.runId to the persisted
    // relay_run_id on the forge run record. If the run hasn't started yet
    // (relay_run_id is null), we accept the first run:started event and treat
    // it as the pairing event.
    // ---------------------------------------------------------------------------
    let pairedRelayRunId = run.relay_run_id;

    const unsubRunner = deps.runner.on((event: WorkflowEvent) => {
      // On first run:started, pair this relay run ID to our forge run
      if (event.type === 'run:started' && pairedRelayRunId === null) {
        // Only accept if no other SSE connection already claimed a different relay run
        const freshRun = deps.storage.getRun(runId);
        if (freshRun && freshRun.relay_run_id !== null) {
          pairedRelayRunId = freshRun.relay_run_id;
        } else {
          pairedRelayRunId = event.runId;
        }
      }

      // Filter: only forward events belonging to this run's relay workflow
      if (pairedRelayRunId !== null && event.runId !== pairedRelayRunId) {
        return;
      }

      // If we still don't have a pairing, only proceed for run:started
      if (pairedRelayRunId === null && event.type !== 'run:started') {
        return;
      }

      const payload = mapRunnerEvent(event, runId);
      if (payload !== null) {
        emitAndPersist(payload);
      }
    });

    // ---------------------------------------------------------------------------
    // Subscribe: gate events
    // ---------------------------------------------------------------------------
    const onGatePending = (data: { gate: Gate; runId: string }): void => {
      if (data.runId !== runId) return;
      const payload: GatePendingEvent = {
        type: 'gate:pending',
        run_id: runId,
        gate_id: data.gate.id,
        step_id: data.gate.step_id,
        step_name: data.gate.step_name,
      };
      emitAndPersist(payload);
    };

    const onGateApproved = (data: { gate: Gate; runId: string }): void => {
      if (data.runId !== runId) return;
      const payload: GateDecidedEvent = {
        type: 'gate:approved',
        run_id: runId,
        gate_id: data.gate.id,
        step_id: data.gate.step_id,
        step_name: data.gate.step_name,
        approver: data.gate.approver,
        decision_note: data.gate.decision_note,
      };
      emitAndPersist(payload);
    };

    const onGateRejected = (data: { gate: Gate; runId: string }): void => {
      if (data.runId !== runId) return;
      const payload: GateDecidedEvent = {
        type: 'gate:rejected',
        run_id: runId,
        gate_id: data.gate.id,
        step_id: data.gate.step_id,
        step_name: data.gate.step_name,
        approver: data.gate.approver,
        decision_note: data.gate.decision_note,
      };
      emitAndPersist(payload);
    };

    deps.gateManager.on('gate:pending', onGatePending);
    deps.gateManager.on('gate:approved', onGateApproved);
    deps.gateManager.on('gate:rejected', onGateRejected);

    // ---------------------------------------------------------------------------
    // Subscribe: question events
    // ---------------------------------------------------------------------------
    const onQuestionPending = (data: {
      question: Question;
      runId: string;
    }): void => {
      if (data.runId !== runId) return;
      const payload: QuestionPendingEvent = {
        type: 'question:pending',
        run_id: runId,
        question_id: data.question.id,
        step_id: data.question.step_id,
        question: data.question.question,
      };
      emitAndPersist(payload);
    };

    const onQuestionAnswered = (data: {
      question: Question;
      runId: string;
    }): void => {
      if (data.runId !== runId) return;
      const payload: QuestionAnsweredEvent = {
        type: 'question:answered',
        run_id: runId,
        question_id: data.question.id,
        step_id: data.question.step_id,
        answer: data.question.answer,
      };
      emitAndPersist(payload);
    };

    const onQuestionDismissed = (data: {
      question: Question;
      runId: string;
    }): void => {
      if (data.runId !== runId) return;
      const payload: QuestionAnsweredEvent = {
        type: 'question:dismissed',
        run_id: runId,
        question_id: data.question.id,
        step_id: data.question.step_id,
        answer: null,
      };
      emitAndPersist(payload);
    };

    deps.questionManager.on('question:pending', onQuestionPending);
    deps.questionManager.on('question:answered', onQuestionAnswered);
    deps.questionManager.on('question:dismissed', onQuestionDismissed);

    // ---------------------------------------------------------------------------
    // Subscribe: run monitor events
    // ---------------------------------------------------------------------------
    const onStepMetrics = (data: StepMetricsPayload): void => {
      if (data.run_id !== runId) return;
      emitAndPersist({ type: 'step:metrics', ...data });
    };

    const onRunMetrics = (data: RunMetricsPayload): void => {
      if (data.run_id !== runId) return;
      emitAndPersist({ type: 'run:metrics', ...data });
    };

    const onStallWarning = (data: StallWarningPayload): void => {
      if (data.run_id !== runId) return;
      emitAndPersist({ type: 'stall:warning', ...data });
    };

    const onStepRetryContext = (data: StepRetryContextPayload): void => {
      if (data.run_id !== runId) return;
      emitAndPersist({ type: 'step:retry-context', ...data });
    };

    const onStepFailedEnriched = (data: StepFailedEnrichedPayload): void => {
      if (data.run_id !== runId) return;
      emitAndPersist({ type: 'step:failed-enriched', ...data });
    };

    const onStepScored = (data: StepScoredPayload): void => {
      if (data.run_id !== runId) return;
      emitAndPersist({ type: 'step:scored', ...data });
    };

    const onStepRetriesExhausted = (data: StepRetriesExhaustedPayload): void => {
      if (data.run_id !== runId) return;
      emitAndPersist({ type: 'step:retries-exhausted', ...data });
    };

    const onStepMergeStatus = (payload: StepMergeStatusPayload): void => {
      if (payload.run_id !== runId) return;
      emitAndPersist({
        type: 'step:merge-status',
        run_id: runId,
        step_name: payload.step_name,
        status: payload.status,
        branch: payload.branch,
        target_branch: payload.target_branch,
        error: payload.error,
      });
    };

    const onContextPressure = (data: ContextPressurePayload): void => {
      if (data.run_id !== runId) return;
      emitAndPersist({ type: 'context:pressure', ...data });
    };

    const onContextBudgetExceeded = (data: ContextBudgetExceededPayload): void => {
      if (data.run_id !== runId) return;
      emitAndPersist({ type: 'context:budget-exceeded', ...data });
    };

    deps.runMonitor.on('step:metrics', onStepMetrics);
    deps.runMonitor.on('run:metrics', onRunMetrics);
    deps.runMonitor.on('stall:warning', onStallWarning);
    deps.runMonitor.on('step:retry-context', onStepRetryContext);
    deps.runMonitor.on('step:failed-enriched', onStepFailedEnriched);
    deps.runMonitor.on('step:scored', onStepScored);
    deps.runMonitor.on('step:retries-exhausted', onStepRetriesExhausted);
    deps.runMonitor.on('step:merge-status', onStepMergeStatus);
    deps.runMonitor.on('context:pressure', onContextPressure);
    deps.runMonitor.on('context:budget-exceeded', onContextBudgetExceeded);

    // ---------------------------------------------------------------------------
    // Keepalive ping every 15 seconds to prevent proxy/load-balancer timeouts
    // ---------------------------------------------------------------------------
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15_000);

    // ---------------------------------------------------------------------------
    // Cleanup on client disconnect
    // ---------------------------------------------------------------------------
    req.on('close', () => {
      unsubRunner();
      deps.gateManager.off('gate:pending', onGatePending);
      deps.gateManager.off('gate:approved', onGateApproved);
      deps.gateManager.off('gate:rejected', onGateRejected);
      deps.questionManager.off('question:pending', onQuestionPending);
      deps.questionManager.off('question:answered', onQuestionAnswered);
      deps.questionManager.off('question:dismissed', onQuestionDismissed);
      deps.runMonitor.off('step:metrics', onStepMetrics);
      deps.runMonitor.off('run:metrics', onRunMetrics);
      deps.runMonitor.off('stall:warning', onStallWarning);
      deps.runMonitor.off('step:retry-context', onStepRetryContext);
      deps.runMonitor.off('step:failed-enriched', onStepFailedEnriched);
      deps.runMonitor.off('step:scored', onStepScored);
      deps.runMonitor.off('step:retries-exhausted', onStepRetriesExhausted);
      deps.runMonitor.off('step:merge-status', onStepMergeStatus);
      deps.runMonitor.off('context:pressure', onContextPressure);
      deps.runMonitor.off('context:budget-exceeded', onContextBudgetExceeded);
      clearInterval(keepalive);
    });
  };
}
