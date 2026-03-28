/**
 * forge-next integration tests.
 *
 * Three focused scenarios:
 *   1. fetchPlan adapter shape — verifies FetchedPlan interface contract
 *   2. Run creation via handler — verifies storage writes with mocked runner
 *   3. Compilation end-to-end — verifies compilePlan output shape
 *
 * WorkflowRunner is always mocked. No relay daemon or network calls.
 * All storage uses in-memory SQLite (:memory:).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { SqliteForgeNextStorage } from '../storage/sqlite.js';
import { compilePlan } from '../compiler.js';
import { GateManager } from '../gate-manager.js';
import { QuestionManager } from '../question-manager.js';
import { RunMonitor } from '../run-monitor.js';
import { ModelSelector } from '../model-selector.js';
import { createRunHandler, activeState } from '../api/handlers.js';
import type { FetchedPlan, RunHandlerDeps } from '../api/handlers.js';
import type { PlanMeta, PlanStep } from '../compiler.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PLAN_META: PlanMeta = {
  plan_id: 'plan-1',
  version: 1,
  summary: { goal: 'Test plan' },
};

const PLAN_STEPS: PlanStep[] = [
  {
    step_id: 'step-1',
    title: 'Setup database',
    description: 'Create the schema',
    dependencies: [],
    owner_role: 'backend:Coder',
    acceptance_criteria: [{ id: 'ac-1', description: 'Schema created' }],
  },
  {
    step_id: 'step-2',
    title: 'Add API endpoints',
    description: 'REST endpoints',
    dependencies: ['step-1'],
    owner_role: 'backend:Coder',
    acceptance_criteria: [{ id: 'ac-2', description: 'Endpoints respond' }],
  },
];

// ---------------------------------------------------------------------------
// Mock runner factory
//
// Each test gets a fresh mock to avoid cross-test state. The on() mock
// captures the subscriber so tests can fire synthetic events if needed,
// and returns an unsubscribe function as the real SDK does.
// ---------------------------------------------------------------------------

function makeMockRunner() {
  const subscribers: Array<(event: unknown) => void> = [];

  const runner = {
    execute: vi.fn().mockResolvedValue({ id: 'relay-run-123' }),
    on: vi.fn().mockImplementation((cb: (event: unknown) => void) => {
      subscribers.push(cb);
      return () => {
        const idx = subscribers.indexOf(cb);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    }),
    pause: vi.fn(),
    unpause: vi.fn(),
    abort: vi.fn(),
    removeAllListeners: vi.fn(),
    /** Helper: fire a synthetic runner event to all subscribers. */
    emit(event: unknown) {
      for (const sub of subscribers) sub(event);
    },
  };

  return runner;
}

// ---------------------------------------------------------------------------
// Minimal Express request/response stubs
// ---------------------------------------------------------------------------

function makeReq(body: unknown): Request {
  return { body, params: {}, query: {} } as unknown as Request;
}

function makeRes() {
  const res = {
    _status: 0,
    _body: null as unknown,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(data: unknown) {
      this._body = data;
      return this;
    },
  };
  return res as typeof res & Response;
}

// ---------------------------------------------------------------------------
// Reset module-level activeState between tests so each test starts idle.
// ---------------------------------------------------------------------------

beforeEach(() => {
  activeState.forgeRunId = null;
  activeState.relayRunId = null;
});

// ===========================================================================
// Test 1: fetchPlan adapter returns correct FetchedPlan shape
// ===========================================================================

describe('fetchPlan adapter', () => {
  it('returns a FetchedPlan with plan and steps matching the interface', async () => {
    const mockFetchPlan = vi.fn().mockResolvedValue({
      plan: PLAN_META,
      steps: PLAN_STEPS,
    } satisfies FetchedPlan);

    const result = await mockFetchPlan('plan-1');

    // plan field
    expect(result.plan).toBeDefined();
    expect(result.plan.plan_id).toBe('plan-1');
    expect(result.plan.version).toBe(1);
    expect(result.plan.summary?.goal).toBe('Test plan');

    // steps field
    expect(Array.isArray(result.steps)).toBe(true);
    expect(result.steps).toHaveLength(2);

    const [first, second] = result.steps as PlanStep[];

    expect(first.step_id).toBe('step-1');
    expect(first.title).toBe('Setup database');
    expect(first.dependencies).toEqual([]);
    expect(first.owner_role).toBe('backend:Coder');
    expect(first.acceptance_criteria).toHaveLength(1);
    expect(first.acceptance_criteria![0].id).toBe('ac-1');

    expect(second.step_id).toBe('step-2');
    expect(second.dependencies).toEqual(['step-1']);
  });

  it('returns null for an unknown plan id', async () => {
    const mockFetchPlan = vi.fn().mockResolvedValue(null);

    const result = await mockFetchPlan('nonexistent-plan');
    expect(result).toBeNull();
  });
});

// ===========================================================================
// Test 2: Run creation via createRunHandler
// ===========================================================================

describe('createRunHandler', () => {
  function buildDeps(overrides?: Partial<RunHandlerDeps>): {
    deps: RunHandlerDeps;
    storage: SqliteForgeNextStorage;
    runner: ReturnType<typeof makeMockRunner>;
  } {
    const storage = new SqliteForgeNextStorage(':memory:');
    const runner = makeMockRunner();

    const gateManager = new GateManager(storage);
    const questionManager = new QuestionManager(storage);
    const runMonitor = new RunMonitor();

    const deps: RunHandlerDeps = {
      storage,
      runner: runner as unknown as RunHandlerDeps['runner'],
      gateManager,
      questionManager,
      runMonitor,
      fetchPlan: vi.fn().mockResolvedValue({ plan: PLAN_META, steps: PLAN_STEPS }),
      ...overrides,
    };

    return { deps, storage, runner };
  }

  it('creates a run record in storage and responds 201 with run_id and status', async () => {
    const { deps, storage } = buildDeps();
    const handler = createRunHandler(deps);

    const req = makeReq({ plan_id: 'plan-1', step_overrides: [] });
    const res = makeRes();

    await handler(req, res);

    expect(res._status).toBe(201);
    const body = res._body as { run_id: string; status: string };
    expect(body.run_id).toBeTruthy();
    expect(body.status).toBe('running');

    // Confirm the record is persisted in storage
    const run = storage.getRun(body.run_id);
    expect(run).not.toBeNull();
    expect(run!.plan_id).toBe('plan-1');
    expect(run!.plan_version).toBe(1);
    // Handler transitions to 'running' immediately before execute resolves
    expect(run!.status).toBe('running');
    expect(run!.workflow_config).toBeTruthy();
  });

  it('parses and stores the compiled workflow_config JSON', async () => {
    const { deps, storage } = buildDeps();
    const handler = createRunHandler(deps);

    const req = makeReq({ plan_id: 'plan-1', step_overrides: [] });
    const res = makeRes();

    await handler(req, res);

    const { run_id } = res._body as { run_id: string };
    const run = storage.getRun(run_id);

    const config = JSON.parse(run!.workflow_config!);
    expect(config.version).toBe('1.0');
    expect(config.name).toMatch(/^plan-plan-1-v1$/);
    expect(config.agents).toBeInstanceOf(Array);
    expect(config.workflows).toBeInstanceOf(Array);
  });

  it('calls runner.execute with the compiled workflow config', async () => {
    const { deps, runner } = buildDeps();
    const handler = createRunHandler(deps);

    const req = makeReq({ plan_id: 'plan-1', step_overrides: [] });
    const res = makeRes();

    await handler(req, res);

    expect(runner.execute).toHaveBeenCalledOnce();
    const [configArg, workflowArg] = runner.execute.mock.calls[0];
    expect(configArg.version).toBe('1.0');
    expect(workflowArg).toBe('execute');
  });

  it('responds 404 when fetchPlan returns null', async () => {
    const { deps } = buildDeps({
      fetchPlan: vi.fn().mockResolvedValue(null),
    });
    const handler = createRunHandler(deps);

    const req = makeReq({ plan_id: 'no-such-plan', step_overrides: [] });
    const res = makeRes();

    await handler(req, res);

    expect(res._status).toBe(404);
    const body = res._body as { error: string };
    expect(body.error).toMatch(/not found/i);
  });

  it('responds 502 when fetchPlan throws', async () => {
    const { deps } = buildDeps({
      fetchPlan: vi.fn().mockRejectedValue(new Error('planner unavailable')),
    });
    const handler = createRunHandler(deps);

    const req = makeReq({ plan_id: 'plan-1', step_overrides: [] });
    const res = makeRes();

    await handler(req, res);

    expect(res._status).toBe(502);
    const body = res._body as { error: string };
    expect(body.error).toMatch(/planner unavailable/);
  });

  it('responds 409 when a run is already active', async () => {
    const { deps } = buildDeps();
    const handler = createRunHandler(deps);

    // First request starts a run
    const req1 = makeReq({ plan_id: 'plan-1', step_overrides: [] });
    const res1 = makeRes();
    await handler(req1, res1);
    expect(res1._status).toBe(201);

    // Second request while first is still marked active
    const req2 = makeReq({ plan_id: 'plan-1', step_overrides: [] });
    const res2 = makeRes();
    await handler(req2, res2);

    expect(res2._status).toBe(409);
    const body = res2._body as { error: string };
    expect(body.error).toMatch(/already in progress/i);
  });

  it('responds 422 for a missing plan_id', async () => {
    const { deps } = buildDeps();
    const handler = createRunHandler(deps);

    const req = makeReq({ step_overrides: [] }); // no plan_id
    const res = makeRes();

    await handler(req, res);

    expect(res._status).toBe(422);
    const body = res._body as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  it('sets activeState.forgeRunId after creating a run', async () => {
    const { deps } = buildDeps();
    const handler = createRunHandler(deps);

    expect(activeState.forgeRunId).toBeNull();

    const req = makeReq({ plan_id: 'plan-1', step_overrides: [] });
    const res = makeRes();
    await handler(req, res);

    const { run_id } = res._body as { run_id: string };
    expect(activeState.forgeRunId).toBe(run_id);
  });

  it('clears activeState when the runner emits run:completed', async () => {
    const { deps, runner } = buildDeps();
    const handler = createRunHandler(deps);

    const req = makeReq({ plan_id: 'plan-1', step_overrides: [] });
    const res = makeRes();
    await handler(req, res);

    const { run_id } = res._body as { run_id: string };
    expect(activeState.forgeRunId).toBe(run_id);

    // Simulate the relay run:completed event
    runner.emit({ type: 'run:completed', runId: 'relay-run-123' });

    expect(activeState.forgeRunId).toBeNull();
  });
});

// ===========================================================================
// Test 3: compilePlan end-to-end
// ===========================================================================

describe('compilePlan', () => {
  it('produces a valid RelayYamlConfig for a two-step plan', () => {
    const { config, stepCriteria } = compilePlan(
      PLAN_META,
      PLAN_STEPS,
      { step_overrides: [] },
      new ModelSelector(),
    );

    // Top-level structure
    expect(config.version).toBe('1.0');
    expect(config.name).toBe('plan-plan-1-v1');
    expect(config.description).toBe('Test plan');

    // Swarm — 2-step sequential chain infers low concurrency (dep density = 1.0)
    expect(config.swarm.pattern).toBe('dag');
    expect(config.swarm.maxConcurrency).toBe(2);
  });

  it('deduplicates agent definitions per unique owner_role', () => {
    // Both steps share owner_role 'backend:Coder' — expect one agent entry
    const { config } = compilePlan(
      PLAN_META,
      PLAN_STEPS,
      { step_overrides: [] },
      new ModelSelector(),
    );

    expect(config.agents).toHaveLength(1);
    expect(config.agents[0].name).toBe('backend-coder');
    expect(config.agents[0].cli).toBe('claude');
  });

  it('creates one workflow named "execute" with correct step count', () => {
    const { config } = compilePlan(
      PLAN_META,
      PLAN_STEPS,
      { step_overrides: [] },
      new ModelSelector(),
    );

    expect(config.workflows).toHaveLength(1);
    const workflow = config.workflows[0];
    expect(workflow.name).toBe('execute');
    expect(workflow.steps).toHaveLength(2);
  });

  it('preserves inter-step dependencies', () => {
    const { config } = compilePlan(
      PLAN_META,
      PLAN_STEPS,
      { step_overrides: [] },
      new ModelSelector(),
    );

    const steps = config.workflows[0].steps;
    const first = steps.find(s => s.name === 'step-1');
    const second = steps.find(s => s.name === 'step-2');

    expect(first).toBeDefined();
    expect(first!.dependsOn).toEqual([]);

    expect(second).toBeDefined();
    expect(second!.dependsOn).toEqual(['step-1']);
  });

  it('embeds acceptance criteria as verification on each step', () => {
    const { config } = compilePlan(
      PLAN_META,
      PLAN_STEPS,
      { step_overrides: [] },
      new ModelSelector(),
    );

    const steps = config.workflows[0].steps;
    const first = steps.find(s => s.name === 'step-1')!;
    const second = steps.find(s => s.name === 'step-2')!;

    expect(first.verification).toBeDefined();
    expect(first.verification!.type).toBe('output_contains');
    expect(first.verification!.value).toBe('Schema created');

    expect(second.verification).toBeDefined();
    expect(second.verification!.value).toBe('Endpoints respond');
  });

  it('populates stepCriteria map with acceptance criteria per step', () => {
    const { stepCriteria } = compilePlan(
      PLAN_META,
      PLAN_STEPS,
      { step_overrides: [] },
      new ModelSelector(),
    );

    expect(stepCriteria.size).toBe(2);
    expect(stepCriteria.get('step-1')).toEqual([
      { id: 'ac-1', description: 'Schema created' },
    ]);
    expect(stepCriteria.get('step-2')).toEqual([
      { id: 'ac-2', description: 'Endpoints respond' },
    ]);
  });

  it('omits skipped steps and drops them from dependsOn lists', () => {
    const { config } = compilePlan(
      PLAN_META,
      PLAN_STEPS,
      {
        step_overrides: [{ step_id: 'step-1', skip: true }],
      },
      new ModelSelector(),
    );

    const steps = config.workflows[0].steps;

    // Only step-2 should survive
    expect(steps).toHaveLength(1);
    expect(steps[0].name).toBe('step-2');
    // step-1 was skipped so it is removed from dependsOn
    expect(steps[0].dependsOn).toEqual([]);
  });

  it('applies model_override per step', () => {
    const { config } = compilePlan(
      PLAN_META,
      [PLAN_STEPS[0]], // single step
      {
        step_overrides: [{ step_id: 'step-1', model_override: 'opus' }],
      },
      new ModelSelector(),
    );

    const agent = config.agents[0];
    expect(agent.constraints?.model).toBe('opus');
  });

  it('assigns default-worker agent when no owner_role is set', () => {
    const stepWithoutRole: PlanStep = {
      step_id: 'step-x',
      title: 'Unclaimed step',
      dependencies: [],
    };

    const { config } = compilePlan(
      PLAN_META,
      [stepWithoutRole],
      { step_overrides: [] },
      new ModelSelector(),
    );

    expect(config.agents[0].name).toBe('default-worker');
    expect(config.workflows[0].steps[0].agent).toBe('default-worker');
  });

  it('includes step title and description in the task string', () => {
    const { config } = compilePlan(
      PLAN_META,
      [PLAN_STEPS[0]],
      { step_overrides: [] },
      new ModelSelector(),
    );

    const task = config.workflows[0].steps[0].task;
    expect(task).toContain('Setup database');
    expect(task).toContain('Create the schema');
    expect(task).toContain('Schema created');
  });

  it('respects execution_policy settings', () => {
    const { config } = compilePlan(
      PLAN_META,
      PLAN_STEPS,
      {
        step_overrides: [],
        execution_policy: { max_concurrent_tasks: 2, max_timeout_ms: 60_000, retry_count: 3 },
      },
      new ModelSelector(),
    );

    expect(config.swarm.maxConcurrency).toBe(2);
    for (const step of config.workflows[0].steps) {
      expect(step.timeoutMs).toBe(60_000);
      expect(step.retries).toBe(3);
    }
  });
});
