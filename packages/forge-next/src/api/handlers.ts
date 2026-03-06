/**
 * Run handlers for the forge-next API.
 *
 * createRunHandler is the critical path — it compiles a plan, starts a relay
 * workflow, and immediately returns. Completion is tracked asynchronously via
 * runner events.
 */

import type { Request, Response } from 'express';
import type { WorkflowRunner } from '@agent-relay/sdk/workflows';
import type { ForgeNextStorage } from '../storage/interface.js';
import type { GateManager } from '../gate-manager.js';
import type { QuestionManager } from '../question-manager.js';
import type { RunMonitor } from '../run-monitor.js';
import type { PlanStep, PlanMeta } from '../compiler.js';
import { compilePlan } from '../compiler.js';
import { ModelSelector } from '../model-selector.js';
import type { ForgeConfig, ForgeNextRun } from '../types.js';
import {
  CreateRunRequestSchema,
  ListRunsQuerySchema,
} from './schemas.js';

// ---------------------------------------------------------------------------
// Typed param extraction
// Express types req.params values as string | string[]. In practice, route
// params from named segments (e.g. :id) are always a plain string. This helper
// narrows the value without unsafe casting.
// ---------------------------------------------------------------------------
function routeParam(req: Request, key: string): string | null {
  const v = req.params[key];
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

// ---------------------------------------------------------------------------
// Dependency contract
// ---------------------------------------------------------------------------

/**
 * Minimal plan data returned by the fetchPlan injected dependency.
 * forge-next does not import @plannr/planner directly.
 */
export interface FetchedPlan {
  plan: PlanMeta;
  steps: PlanStep[];
}

export interface RunHandlerDeps {
  storage: ForgeNextStorage;
  runner: WorkflowRunner;
  gateManager: GateManager;
  questionManager: QuestionManager;
  runMonitor: RunMonitor;
  fetchPlan: (planId: string, version?: number) => Promise<FetchedPlan | null>;
}

// ---------------------------------------------------------------------------
// In-memory active run tracking (single-run-at-a-time invariant)
// ---------------------------------------------------------------------------

/**
 * The forge-next runner is a singleton shared across requests.
 * We track the currently active forge run ID so we can:
 *  1. Reject concurrent run creation with 409.
 *  2. Map relay WorkflowEvent.runId back to the forge run ID for SSE.
 */
const activeState = {
  /** forge run ID of the currently executing run, or null if idle. */
  forgeRunId: null as string | null,
  /** relay run ID emitted by the first run:started event for the active run. */
  relayRunId: null as string | null,
};

/**
 * Returns true if there is a run currently executing (not yet completed/failed/cancelled).
 */
function isRunActive(): boolean {
  return activeState.forgeRunId !== null;
}

/**
 * Clears the active run state so new runs can be accepted.
 */
function clearActiveRun(): void {
  activeState.forgeRunId = null;
  activeState.relayRunId = null;
}

// ---------------------------------------------------------------------------
// POST /runs — create and start a run
// ---------------------------------------------------------------------------

export function createRunHandler(deps: RunHandlerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    // Validate request body
    const parseResult = CreateRunRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(422).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
      return;
    }

    const body = parseResult.data;

    // Single-run-at-a-time: reject if a run is already executing
    if (isRunActive()) {
      res.status(409).json({
        error: 'A run is already in progress',
        run_id: activeState.forgeRunId,
      });
      return;
    }

    // Fetch plan from planner
    let fetched: FetchedPlan | null;
    try {
      fetched = await deps.fetchPlan(body.plan_id, body.plan_version);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[forge-next] fetchPlan error:', msg);
      res.status(502).json({ error: `Failed to fetch plan: ${msg}` });
      return;
    }

    if (!fetched) {
      res.status(404).json({
        error: `Plan not found: ${body.plan_id}${body.plan_version !== undefined ? ` v${body.plan_version}` : ''}`,
      });
      return;
    }

    const { plan, steps } = fetched;

    // Map our types.ts StepOverride (field: model) to compiler's StepOverride (field: model_override)
    const compilerConfig = {
      workspace_path: body.workspace_path,
      execution_policy: body.execution_policy,
      step_overrides: body.step_overrides.map(o => ({
        step_id: o.step_id,
        skip: o.skip,
        model_override: o.model,
      })),
    };

    // Compile plan → WorkflowConfig
    let workflowConfig;
    let compilation;
    try {
      compilation = compilePlan(
        plan,
        steps,
        compilerConfig as ForgeConfig,
        new ModelSelector(),
      );
      workflowConfig = compilation.config;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[forge-next] compilePlan error:', msg);
      res.status(422).json({ error: `Plan compilation failed: ${msg}` });
      return;
    }

    // Persist the forge run record
    const now = new Date().toISOString();
    const runId = crypto.randomUUID();

    const forgeRun: ForgeNextRun = {
      id: runId,
      plan_id: body.plan_id,
      plan_version: plan.version,
      relay_run_id: null,
      status: 'pending',
      config: JSON.stringify({
        workspace_path: body.workspace_path,
        step_overrides: body.step_overrides,
        execution_policy: body.execution_policy,
      } satisfies ForgeConfig),
      workflow_config: JSON.stringify(workflowConfig),
      error: null,
      created_at: now,
      updated_at: now,
    };

    deps.storage.createRun(forgeRun);

    // Set up GateManager: register which steps have gates
    const gateSteps = new Map<string, { step_name: string; approver_role?: string }>();
    for (const step of steps) {
      if (step.gate?.type === 'human_approval') {
        gateSteps.set(step.step_id, {
          step_name: step.title,
          approver_role: step.gate.approver_role,
        });
      }
    }
    deps.gateManager.reset();
    deps.gateManager.setForgeRunId(runId);
    deps.gateManager.setGateSteps(gateSteps);
    deps.gateManager.bind(deps.runner);

    // Set up QuestionManager for this run
    deps.questionManager.reset();
    deps.questionManager.setRun(runId);

    // Set up RunMonitor for this run
    deps.runMonitor.reset();
    deps.runMonitor.setForgeRunId(runId);
    deps.runMonitor.setWorkflowConfig(workflowConfig);
    deps.runMonitor.setStepCriteria(compilation.stepCriteria);
    deps.runMonitor.setStepRetryHints(compilation.stepRetryHints);
    deps.runMonitor.setStepMergeStrategies(compilation.stepMergeStrategies);
    deps.runMonitor.setRetryLimit(body.execution_policy?.retry_count ?? 0);
    deps.runMonitor.bind(deps.runner);

    // Subscribe to runner events to:
    //  1. Map the relay run ID (needed for SSE correlation)
    //  2. Update the forge run status on completion/failure
    const unsubRunnerCompletion = deps.runner.on(event => {
      if (event.type === 'run:started') {
        // Capture the relay-assigned run ID for this forge run
        if (activeState.forgeRunId === runId) {
          activeState.relayRunId = event.runId;
        }
        deps.storage.updateRun(runId, {
          relay_run_id: event.runId,
          status: 'running',
          updated_at: new Date().toISOString(),
        });
        return;
      }

      if (event.type === 'run:completed') {
        deps.storage.updateRun(runId, {
          status: 'completed',
          updated_at: new Date().toISOString(),
        });
        clearActiveRun();
        unsubRunnerCompletion();
        return;
      }

      if (event.type === 'run:failed') {
        deps.storage.updateRun(runId, {
          status: 'failed',
          error: event.error,
          updated_at: new Date().toISOString(),
        });
        clearActiveRun();
        unsubRunnerCompletion();
        return;
      }

      if (event.type === 'run:cancelled') {
        deps.storage.updateRun(runId, {
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        });
        clearActiveRun();
        unsubRunnerCompletion();
        return;
      }
    });

    // Mark run as active BEFORE starting execution so no concurrent run can slip through
    activeState.forgeRunId = runId;

    // Transition run to 'running' immediately (relay will confirm via event but we set it
    // here so the GET endpoint returns a sensible status before the first event fires)
    deps.storage.updateRun(runId, {
      status: 'running',
      updated_at: new Date().toISOString(),
    });

    // Start execution — NON-BLOCKING. The promise is handled asynchronously.
    deps.runner.execute(workflowConfig, 'execute').then(_result => {
      // Status is already updated via the event subscription above.
      // Nothing more to do here.
    }).catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[forge-next] runner.execute error:', msg);
      deps.storage.updateRun(runId, {
        status: 'failed',
        error: msg,
        updated_at: new Date().toISOString(),
      });
      clearActiveRun();
      unsubRunnerCompletion();
    });

    res.status(201).json({
      run_id: runId,
      status: 'running',
    });
  };
}

// ---------------------------------------------------------------------------
// GET /runs — list runs
// ---------------------------------------------------------------------------

export function listRunsHandler(deps: RunHandlerDeps) {
  return (req: Request, res: Response): void => {
    const parseResult = ListRunsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(422).json({
        error: 'Invalid query parameters',
        details: parseResult.error.issues,
      });
      return;
    }

    const runs = deps.storage.listRuns(parseResult.data.limit);
    res.status(200).json({ runs });
  };
}

// ---------------------------------------------------------------------------
// GET /runs/:id — get a single run with relay step details
// ---------------------------------------------------------------------------

export function getRunHandler(deps: RunHandlerDeps) {
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

    // Step-level detail is delivered via the SSE event stream (GET /runs/:id/events).
    // This endpoint returns the run record plus gate and question summaries so the
    // UI can restore full state on page load without an SSE connection.
    const gates = deps.storage.listGatesByRun(runId);
    const questions = deps.storage.listQuestionsByRun(runId);

    res.status(200).json({ run, gates, questions });
  };
}

// ---------------------------------------------------------------------------
// POST /runs/:id/pause
// ---------------------------------------------------------------------------

export function pauseRunHandler(deps: RunHandlerDeps) {
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

    if (run.status !== 'running') {
      res.status(409).json({ error: `Run ${runId} is not running (current status: ${run.status})` });
      return;
    }

    try {
      deps.runner.pause();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[forge-next] runner.pause error:', msg);
      res.status(500).json({ error: `Failed to pause run: ${msg}` });
      return;
    }

    deps.storage.updateRun(runId, {
      status: 'paused',
      updated_at: new Date().toISOString(),
    });

    res.status(200).json({ run_id: runId, status: 'paused' });
  };
}

// ---------------------------------------------------------------------------
// POST /runs/:id/resume
// ---------------------------------------------------------------------------

export function resumeRunHandler(deps: RunHandlerDeps) {
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

    if (run.status !== 'paused') {
      res.status(409).json({ error: `Run ${runId} is not paused (current status: ${run.status})` });
      return;
    }

    try {
      deps.runner.unpause();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[forge-next] runner.unpause error:', msg);
      res.status(500).json({ error: `Failed to resume run: ${msg}` });
      return;
    }

    deps.storage.updateRun(runId, {
      status: 'running',
      updated_at: new Date().toISOString(),
    });

    res.status(200).json({ run_id: runId, status: 'running' });
  };
}

// ---------------------------------------------------------------------------
// POST /runs/:id/cancel
// ---------------------------------------------------------------------------

export function cancelRunHandler(deps: RunHandlerDeps) {
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

    const cancellableStatuses = ['running', 'paused', 'pending'];
    if (!cancellableStatuses.includes(run.status)) {
      res.status(409).json({
        error: `Run ${runId} cannot be cancelled (current status: ${run.status})`,
      });
      return;
    }

    try {
      deps.runner.abort();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[forge-next] runner.abort error:', msg);
      res.status(500).json({ error: `Failed to cancel run: ${msg}` });
      return;
    }

    // Status will be updated to 'cancelled' via the run:cancelled event subscription
    // in createRunHandler. We also update immediately for runs that were never started.
    deps.storage.updateRun(runId, {
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    });

    if (activeState.forgeRunId === runId) {
      clearActiveRun();
    }

    res.status(200).json({ run_id: runId, status: 'cancelled' });
  };
}

// ---------------------------------------------------------------------------
// POST /runs/:runId/steps/:stepName/retry — stub (needs relay SDK per-step retry)
// ---------------------------------------------------------------------------

export function retryStepHandler(_deps: RunHandlerDeps) {
  return (req: Request, res: Response): void => {
    const runId = routeParam(req, 'runId');
    const stepName = routeParam(req, 'stepName');
    if (!runId || !stepName) {
      res.status(400).json({ error: 'Run ID and step name are required' });
      return;
    }

    const run = _deps.storage.getRun(runId);
    if (!run) {
      res.status(404).json({ error: `Run not found: ${runId}` });
      return;
    }

    // The relay SDK WorkflowRunner does not expose per-step retry.
    // Retries are handled internally via the `retries` config on each WorkflowStep.
    // This endpoint is reserved for future relay SDK enhancement (see relay issue #498).
    res.status(501).json({
      error: 'Per-step retry is not yet supported by the relay SDK',
      detail: 'The WorkflowRunner handles retries internally. Per-step retry requires relay SDK enhancement (issue #498).',
      run_id: runId,
      step_name: stepName,
    });
  };
}

// ---------------------------------------------------------------------------
// POST /runs/:runId/steps/:stepName/skip — stub (needs relay SDK per-step skip)
// ---------------------------------------------------------------------------

export function skipStepHandler(_deps: RunHandlerDeps) {
  return (req: Request, res: Response): void => {
    const runId = routeParam(req, 'runId');
    const stepName = routeParam(req, 'stepName');
    if (!runId || !stepName) {
      res.status(400).json({ error: 'Run ID and step name are required' });
      return;
    }

    const run = _deps.storage.getRun(runId);
    if (!run) {
      res.status(404).json({ error: `Run not found: ${runId}` });
      return;
    }

    // The relay SDK WorkflowRunner has markDownstreamSkipped (private) but no
    // public per-step skip. This endpoint is reserved for future relay SDK
    // enhancement (see relay issue #498).
    res.status(501).json({
      error: 'Per-step skip is not yet supported by the relay SDK',
      detail: 'The WorkflowRunner skips downstream steps on failure but does not support manual per-step skip. Requires relay SDK enhancement (issue #498).',
      run_id: runId,
      step_name: stepName,
    });
  };
}

// ---------------------------------------------------------------------------
// Export active state accessor (needed by SSE handler for relay run ID lookup)
// ---------------------------------------------------------------------------

export { activeState };
