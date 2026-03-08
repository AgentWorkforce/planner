/**
 * Event wiring — connects forge-next event sources to the GlobalEventBus.
 *
 * Subscribes to the WorkflowRunner, GateManager, and QuestionManager.
 * Translates their domain-specific events into GlobalEvent payloads with
 * session context resolved from planner storage.
 *
 * Called once during server initialization after all services are mounted.
 */

import type { WorkflowRunner, WorkflowEvent } from '@agent-relay/sdk/workflows';
import { emitGlobal, type GlobalEvent } from './global-bus.js';

// Minimal interfaces to avoid coupling to sibling package source files.
// The actual instances are injected from server.ts which already imports them.

interface ForgeNextRun {
  id: string;
  plan_id: string;
  relay_run_id: string | null;
}

interface ForgeNextStorageReader {
  getRun(id: string): ForgeNextRun | null;
  listRuns(limit?: number): ForgeNextRun[];
}

interface PlanReader {
  getPlan(planId: string): { plan_id: string; source_session_id?: string } | null;
  getLatestVersion(planId: string): { summary?: { goal?: string } } | null;
}

interface RunMonitorLike {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
}

interface GateManagerLike {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
}

interface QuestionManagerLike {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
}

export interface EventWiringDeps {
  runner: WorkflowRunner;
  runMonitor: RunMonitorLike;
  gateManager: GateManagerLike;
  questionManager: QuestionManagerLike;
  forgeNextStorage: ForgeNextStorageReader;
  plannerStorage: PlanReader;
}

/**
 * Resolve the source session ID and plan goal from a forge-next run.
 * Returns null if the chain breaks (run not found, plan not found, no session).
 */
function resolveRunContext(
  runId: string,
  deps: Pick<EventWiringDeps, 'forgeNextStorage' | 'plannerStorage'>,
): { sourceSessionId: string; planId: string; planGoal: string } | null {
  const run = deps.forgeNextStorage.getRun(runId);
  if (!run) return null;

  const plan = deps.plannerStorage.getPlan(run.plan_id);
  if (!plan?.source_session_id) return null;

  const latestVersion = deps.plannerStorage.getLatestVersion(run.plan_id);
  const goal = latestVersion?.summary?.goal ?? 'Build';

  return {
    sourceSessionId: plan.source_session_id,
    planId: run.plan_id,
    planGoal: goal,
  };
}

export function wireGlobalEvents(deps: EventWiringDeps): () => void {
  const cleanups: (() => void)[] = [];

  // ── Runner: run:completed / run:failed ──────────────────────────────────
  const unsubRunner = deps.runner.on((event: WorkflowEvent) => {
    if (event.type !== 'run:completed' && event.type !== 'run:failed') return;

    // Map relay run ID back to forge run
    const recentRuns = deps.forgeNextStorage.listRuns(10);
    const forgeRun = recentRuns.find((r: ForgeNextRun) => r.relay_run_id === event.runId);
    if (!forgeRun) return;

    const ctx = resolveRunContext(forgeRun.id, deps);
    if (!ctx) return;

    const globalEvent: GlobalEvent = {
      type: event.type === 'run:completed' ? 'build:completed' : 'build:failed',
      sourceSessionId: ctx.sourceSessionId,
      planId: ctx.planId,
      runId: forgeRun.id,
      summary: event.type === 'run:completed'
        ? `Build completed: ${ctx.planGoal}`
        : `Build failed: ${ctx.planGoal}`,
      timestamp: new Date().toISOString(),
    };

    emitGlobal(globalEvent);
  });
  cleanups.push(unsubRunner);

  // ── GateManager: gate:pending ───────────────────────────────────────────
  const onGatePending = (data: { gate: { step_name: string }; runId: string }): void => {
    const ctx = resolveRunContext(data.runId, deps);
    if (!ctx) return;

    emitGlobal({
      type: 'gate:pending',
      sourceSessionId: ctx.sourceSessionId,
      planId: ctx.planId,
      runId: data.runId,
      stepName: data.gate.step_name,
      summary: `Gate approval needed: ${data.gate.step_name}`,
      timestamp: new Date().toISOString(),
    });
  };

  deps.gateManager.on('gate:pending', onGatePending);
  cleanups.push(() => deps.gateManager.off('gate:pending', onGatePending));

  // ── QuestionManager: question:pending ───────────────────────────────────
  const onQuestionPending = (data: { question: { question: string; step_id: string }; runId: string }): void => {
    const ctx = resolveRunContext(data.runId, deps);
    if (!ctx) return;

    const q = data.question.question;
    const short = q.length > 80 ? q.slice(0, 77) + '...' : q;

    emitGlobal({
      type: 'question:pending',
      sourceSessionId: ctx.sourceSessionId,
      planId: ctx.planId,
      runId: data.runId,
      stepName: data.question.step_id,
      summary: `Agent asks: ${short}`,
      timestamp: new Date().toISOString(),
    });
  };

  deps.questionManager.on('question:pending', onQuestionPending);
  cleanups.push(() => deps.questionManager.off('question:pending', onQuestionPending));

  console.log('[global-events] Wired forge-next events to global event bus');

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
