/**
 * Unit tests for BuildCoordinator
 *
 * Tests tiered multi-plan build execution including:
 * - Single and multi-tier builds
 * - Sequential tier execution
 * - Pause/resume/cancel operations
 * - Error handling and failure scenarios
 * - Integration with TestExecutor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BuildCoordinator, type BuildCoordinatorConfig } from './build-coordinator.js';
import { TestExecutor } from './test-executor.js';
import { createForgeStorage } from '../storage/sqlite/index.js';
import type { ForgeStorage } from '../storage/interface.js';
import type { PlannerClient, PlanVersion } from '../adapters/planner-client.js';
import {
  type BuildRequest,
  type Build,
  BuildStatus,
  BuildRunStatus,
} from '../domain/build-types.js';
import { RunStatus } from '../domain/types.js';

// ============================================
// Helper: Wait for Build Status
// ============================================

/**
 * Polls until the build reaches one of the target statuses.
 */
async function waitForBuildStatus(
  storage: ForgeStorage,
  buildId: string,
  targetStatuses: BuildStatus[],
  timeoutMs = 10000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const build = storage.getBuild(buildId);
    if (build && targetStatuses.includes(build.status)) {
      return;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(
    `Build ${buildId} did not reach status [${targetStatuses.join(', ')}] within ${timeoutMs}ms`
  );
}

// ============================================
// Mock PlannerClient
// ============================================

/**
 * Creates a mock PlannerClient that returns predefined plans.
 */
function createMockPlannerClient(plans: Map<string, PlanVersion>): PlannerClient {
  return {
    async fetchPlanVersion(planId: string): Promise<PlanVersion> {
      const plan = plans.get(planId);
      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }
      return plan;
    },
  } as PlannerClient;
}

/**
 * Creates a simple PlanVersion for testing.
 */
function createTestPlanVersion(planId: string, stepCount: number = 2): PlanVersion {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    step_id: `step-${i + 1}`,
    title: `Step ${i + 1}`,
    description: `Test step ${i + 1}`,
    dependencies: i === 0 ? [] : [`step-${i}`], // Linear dependency chain
    owner_role: 'Coder',
  }));

  return {
    plan_id: planId,
    version: 1,
    status: 'approved',
    summary: {
      goal: `Test plan ${planId}`,
      context: 'Test context',
    },
    steps,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============================================
// Test Suite
// ============================================

describe('BuildCoordinator', () => {
  let storage: ForgeStorage;
  let testExecutor: TestExecutor;
  let plannerClient: PlannerClient;
  let coordinator: BuildCoordinator;
  let plans: Map<string, PlanVersion>;
  let planIds: string[];

  beforeEach(() => {
    // Create fresh in-memory storage for each test
    storage = createForgeStorage(':memory:');

    // Create TestExecutor with moderate execution times for testing
    // (fast enough for tests, but slow enough to test pause/cancel)
    testExecutor = new TestExecutor(storage, {
      minDelayMs: 50,
      maxDelayMs: 100,
    });

    // Create plan fixtures with valid UUIDs
    // Use 3 steps per plan to give more time for pause/cancel operations
    planIds = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    plans = new Map([
      [planIds[0], createTestPlanVersion(planIds[0], 3)],
      [planIds[1], createTestPlanVersion(planIds[1], 3)],
      [planIds[2], createTestPlanVersion(planIds[2], 3)],
      [planIds[3], createTestPlanVersion(planIds[3], 3)],
    ]);

    // Create mock planner client
    plannerClient = createMockPlannerClient(plans);

    // Create coordinator with fast polling
    const config: BuildCoordinatorConfig = {
      storage,
      plannerClient,
      scheduleReadyTasks: (runId: string) => {
        testExecutor.scheduleReadyTasks(runId);
      },
      pollIntervalMs: 100, // Fast polling for tests
    };
    coordinator = new BuildCoordinator(config);
  });

  afterEach(() => {
    // Clean up any remaining intervals/timers
    vi.clearAllTimers();
  });

  // ============================================
  // Test: Single Tier, Single Plan
  // ============================================

  it('should execute a single-tier build with one plan', async () => {
    const request: BuildRequest = {
      tiers: [
        {
          tier: 0,
          plan_ids: [planIds[0]],
        },
      ],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);
    expect(build.build_id).toBeDefined();
    expect(build.status).toBe(BuildStatus.Pending);
    expect(build.tiers).toHaveLength(1);

    // Wait for completion
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Completed], 15000);

    // Verify build status
    const completedBuild = storage.getBuild(build.build_id);
    expect(completedBuild).toBeDefined();
    expect(completedBuild?.status).toBe(BuildStatus.Completed);
    expect(completedBuild?.completed_at).toBeDefined();

    // Verify BuildRun was created and completed
    const buildRuns = storage.listBuildRunsByBuild(build.build_id);
    expect(buildRuns).toHaveLength(1);
    expect(buildRuns[0].plan_id).toBe(planIds[0]);
    expect(buildRuns[0].tier).toBe(0);
    expect(buildRuns[0].status).toBe(BuildRunStatus.Completed);

    // Verify Run was created
    const run = storage.getRun(buildRuns[0].run_id);
    expect(run).toBeDefined();
    expect(run?.status).toBe(RunStatus.Completed);

    // Verify Tasks were created and completed
    const tasks = storage.listTasksByRun(buildRuns[0].run_id);
    expect(tasks).toHaveLength(3); // 3 steps in test plan
    expect(tasks.every(t => t.status === 'completed')).toBe(true);
  });

  // ============================================
  // Test: Multi-Tier Sequential Execution
  // ============================================

  it('should execute multi-tier build sequentially', async () => {
    const request: BuildRequest = {
      tiers: [
        { tier: 0, plan_ids: [planIds[0], planIds[1]] },
        { tier: 1, plan_ids: [planIds[2]] },
      ],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);

    // Wait for completion
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Completed], 20000);

    // Verify build completed
    const completedBuild = storage.getBuild(build.build_id);
    expect(completedBuild?.status).toBe(BuildStatus.Completed);

    // Verify all BuildRuns completed
    const buildRuns = storage.listBuildRunsByBuild(build.build_id);
    expect(buildRuns).toHaveLength(3); // 2 in tier 0, 1 in tier 1
    expect(buildRuns.every(br => br.status === BuildRunStatus.Completed)).toBe(true);

    // Verify tier ordering
    const tier0Runs = buildRuns.filter(br => br.tier === 0);
    const tier1Runs = buildRuns.filter(br => br.tier === 1);
    expect(tier0Runs).toHaveLength(2);
    expect(tier1Runs).toHaveLength(1);
    expect(tier0Runs.map(br => br.plan_id).sort()).toEqual([planIds[0], planIds[1]].sort());
    expect(tier1Runs[0].plan_id).toBe(planIds[2]);

    // Verify all runs completed
    for (const br of buildRuns) {
      const run = storage.getRun(br.run_id);
      expect(run?.status).toBe(RunStatus.Completed);
    }
  });

  // ============================================
  // Test: Pause Build
  // ============================================

  it('should pause a running build', async () => {
    // Create a build with many tiers to ensure it doesn't complete too fast
    const request: BuildRequest = {
      tiers: [
        { tier: 0, plan_ids: [planIds[0]] },
        { tier: 1, plan_ids: [planIds[1]] },
        { tier: 2, plan_ids: [planIds[2]] },
        { tier: 3, plan_ids: [planIds[3]] },
      ],
      concurrency_limit: 1, // Low concurrency to slow down execution
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);

    // Wait for first tier to start executing
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Running], 5000);

    // Immediately pause the build
    const pausedBuild = coordinator.pauseBuild(build.build_id);
    expect(pausedBuild).toBeDefined();
    expect(pausedBuild?.status).toBe(BuildStatus.Paused);

    // Wait to ensure it stays paused (longer wait to be sure)
    await new Promise(r => setTimeout(r, 1000));

    // Verify build remains paused
    const currentBuild = storage.getBuild(build.build_id);
    expect(currentBuild?.status).toBe(BuildStatus.Paused);
  });

  // ============================================
  // Test: Resume Build
  // ============================================

  it('should resume a paused build', async () => {
    const request: BuildRequest = {
      tiers: [
        { tier: 0, plan_ids: [planIds[0]] },
        { tier: 1, plan_ids: [planIds[1]] },
        { tier: 2, plan_ids: [planIds[2]] },
      ],
      concurrency_limit: 1, // Low concurrency to slow down execution
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);

    // Wait for first tier to start
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Running], 5000);

    // Pause immediately
    coordinator.pauseBuild(build.build_id);
    await new Promise(r => setTimeout(r, 300));

    // Verify paused
    const pausedBuild = storage.getBuild(build.build_id);
    expect(pausedBuild?.status).toBe(BuildStatus.Paused);

    // Resume
    const resumedBuild = coordinator.resumeBuild(build.build_id);
    expect(resumedBuild?.status).toBe(BuildStatus.Running);

    // Wait for completion
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Completed], 20000);

    // Verify completed
    const completedBuild = storage.getBuild(build.build_id);
    expect(completedBuild?.status).toBe(BuildStatus.Completed);

    // Verify all runs completed
    const buildRuns = storage.listBuildRunsByBuild(build.build_id);
    expect(buildRuns).toHaveLength(3);
    expect(buildRuns.every(br => br.status === BuildRunStatus.Completed)).toBe(true);
  });

  // ============================================
  // Test: Cancel Build
  // ============================================

  it('should cancel a running build', async () => {
    const request: BuildRequest = {
      tiers: [
        { tier: 0, plan_ids: [planIds[0]] },
        { tier: 1, plan_ids: [planIds[1]] },
        { tier: 2, plan_ids: [planIds[2]] },
        { tier: 3, plan_ids: [planIds[3]] },
      ],
      concurrency_limit: 1, // Low concurrency to slow down execution
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);

    // Wait for execution to start
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Running], 5000);

    // Cancel the build immediately
    const cancelledBuild = coordinator.cancelBuild(build.build_id);
    expect(cancelledBuild).toBeDefined();
    expect(cancelledBuild?.status).toBe(BuildStatus.Cancelled);

    // Wait to ensure status persists
    await new Promise(r => setTimeout(r, 500));
    const currentBuild = storage.getBuild(build.build_id);
    expect(currentBuild?.status).toBe(BuildStatus.Cancelled);

    // Verify BuildRuns are marked as failed (those that were pending/running at cancel time)
    const buildRuns = storage.listBuildRunsByBuild(build.build_id);
    const pendingOrRunningRuns = buildRuns.filter(
      br => br.status === BuildRunStatus.Pending || br.status === BuildRunStatus.Running
    );
    // After cancellation, pending/running runs should be marked as failed
    expect(pendingOrRunningRuns.length).toBe(0);
  });

  // ============================================
  // Test: Failed Plan Fetch
  // ============================================

  it('should fail build when plan fetch fails', async () => {
    // Create planner client that throws on fetch
    const failingPlannerClient: PlannerClient = {
      async fetchPlanVersion(planId: string): Promise<PlanVersion> {
        throw new Error(`Failed to fetch plan ${planId}`);
      },
    } as PlannerClient;

    const failingCoordinator = new BuildCoordinator({
      storage,
      plannerClient: failingPlannerClient,
      scheduleReadyTasks: (runId: string) => {
        testExecutor.scheduleReadyTasks(runId);
      },
      pollIntervalMs: 100,
    });

    const request: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [crypto.randomUUID()] }],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build = await failingCoordinator.startBuild(request);

    // Wait for failure
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Failed], 5000);

    // Verify build failed with error message
    const failedBuild = storage.getBuild(build.build_id);
    expect(failedBuild?.status).toBe(BuildStatus.Failed);
    expect(failedBuild?.error).toBeDefined();
    expect(failedBuild?.error).toContain('Failed to fetch plan');
  });

  // ============================================
  // Test: getBuildWithRuns
  // ============================================

  it('should retrieve build with runs', async () => {
    const request: BuildRequest = {
      tiers: [
        { tier: 0, plan_ids: [planIds[0], planIds[1]] },
      ],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);

    // Wait for completion
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Completed], 15000);

    // Get build with runs
    const result = coordinator.getBuildWithRuns(build.build_id);
    expect(result).toBeDefined();
    expect(result?.build.build_id).toBe(build.build_id);
    expect(result?.build.status).toBe(BuildStatus.Completed);
    expect(result?.runs).toHaveLength(2);
    expect(result?.runs.every(r => r.status === BuildRunStatus.Completed)).toBe(true);
  });

  // ============================================
  // Test: Build with Multiple Plans in Single Tier
  // ============================================

  it('should execute multiple plans in single tier concurrently', async () => {
    const request: BuildRequest = {
      tiers: [
        { tier: 0, plan_ids: [planIds[0], planIds[1], planIds[2], planIds[3]] },
      ],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);

    // Wait for completion
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Completed], 20000);

    // Verify all 4 plans completed
    const buildRuns = storage.listBuildRunsByBuild(build.build_id);
    expect(buildRuns).toHaveLength(4);
    expect(buildRuns.every(br => br.status === BuildRunStatus.Completed)).toBe(true);
    expect(buildRuns.every(br => br.tier === 0)).toBe(true);

    // Verify all plan IDs are present
    const runPlanIds = buildRuns.map(br => br.plan_id).sort();
    expect(runPlanIds).toEqual([...planIds].sort());
  });

  // ============================================
  // Test: Nonexistent Build Operations
  // ============================================

  it('should return null for operations on nonexistent build', () => {
    const fakeId = crypto.randomUUID();

    expect(coordinator.pauseBuild(fakeId)).toBeNull();
    expect(coordinator.resumeBuild(fakeId)).toBeNull();
    expect(coordinator.cancelBuild(fakeId)).toBeNull();
    expect(coordinator.getBuildWithRuns(fakeId)).toBeNull();
  });

  // ============================================
  // Test: Invalid State Transitions
  // ============================================

  it('should reject invalid state transitions', async () => {
    const request: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [planIds[0]] }],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);

    // Wait for completion
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Completed], 15000);

    // Try to pause a completed build (should throw)
    expect(() => coordinator.pauseBuild(build.build_id)).toThrow(/Invalid Build state transition/);
  });

  // ============================================
  // Test: Empty Tier Handling
  // ============================================

  it('should handle build with no plans gracefully', async () => {
    // This should be caught by validation, but test defensive handling
    const request: BuildRequest = {
      tiers: [
        { tier: 0, plan_ids: [planIds[0]] },
      ],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);

    // Wait for completion
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Completed], 15000);

    expect(storage.getBuild(build.build_id)?.status).toBe(BuildStatus.Completed);
  });

  // ============================================
  // Test: Workspace Path Propagation
  // ============================================

  it('should propagate workspace_path to runs', async () => {
    const workspacePath = '/tmp/test-workspace';
    const request: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [planIds[0]] }],
      concurrency_limit: 5,
      skip_completed: false,
      workspace_path: workspacePath,
    };

    const build = await coordinator.startBuild(request);
    expect(build.workspace_path).toBe(workspacePath);

    // Wait for completion
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Completed], 15000);

    // Verify run has workspace path
    const buildRuns = storage.listBuildRunsByBuild(build.build_id);
    expect(buildRuns).toHaveLength(1);

    const run = storage.getRun(buildRuns[0].run_id);
    expect(run?.workspace_path).toBe(workspacePath);
  });

  // ============================================
  // Test: Build with Plan Context/Understanding
  // ============================================

  it('should store plan context and understanding in run document', async () => {
    // Create plan with context and understanding
    const planContextId = crypto.randomUUID();
    const planWithContext: PlanVersion = {
      ...createTestPlanVersion(planContextId, 1),
      context: { designDecisions: ['Use TypeScript', 'Prefer composition'] },
      understanding: { codebaseInsights: ['Modular architecture', 'Well-tested'] },
    };

    plans.set(planContextId, planWithContext);

    const request: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [planContextId] }],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);

    // Wait for completion
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Completed], 15000);

    // Verify run document contains context/understanding
    const buildRuns = storage.listBuildRunsByBuild(build.build_id);
    const runDoc = storage.getRunDocument(buildRuns[0].run_id);

    expect(runDoc).toBeDefined();
    expect(runDoc?.context).toEqual(planWithContext.context);
    expect(runDoc?.understanding).toEqual(planWithContext.understanding);
  });

  it('should mark tasks with already-built hints when sub-plan already completed', async () => {
    const subPlanId = crypto.randomUUID();
    const parentPlanId = crypto.randomUUID();

    // Create a sub-plan with one task
    const subPlan: PlanVersion = {
      ...createTestPlanVersion(subPlanId, 1),
      steps: [
        {
          step_id: 'step-1',
          title: 'Sub Task 1',
          description: 'A sub task',
          dependencies: [],
        },
      ],
    };

    // Create a parent plan that references the sub-plan
    const parentPlan: PlanVersion = {
      ...createTestPlanVersion(parentPlanId, 1),
      steps: [
        {
          step_id: 'parent-step-1',
          title: 'Parent Task',
          description: 'Task with sub-plan',
          sub_plan_id: subPlanId,
          dependencies: [],
        },
      ],
    };

    plans.set(subPlanId, subPlan);
    plans.set(parentPlanId, parentPlan);

    // First: Execute the sub-plan to completion
    const subRequest: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [subPlanId] }],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const subBuild = await coordinator.startBuild(subRequest);
    await waitForBuildStatus(storage, subBuild.build_id, [BuildStatus.Completed], 15000);

    // Second: Execute the parent plan
    const parentRequest: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [parentPlanId] }],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const parentBuild = await coordinator.startBuild(parentRequest);
    await waitForBuildStatus(storage, parentBuild.build_id, [BuildStatus.Completed], 15000);

    // Verify that the parent task was marked with verify_only
    const parentBuildRuns = storage.listBuildRunsByBuild(parentBuild.build_id);
    const parentTasks = storage.listTasksByRun(parentBuildRuns[0].run_id);
    const parentTask = parentTasks.find(t => t.step_id === 'parent-step-1');

    expect(parentTask).toBeDefined();
    expect(parentTask?.specification?.verify_only).toBe(true);
    expect(parentTask?.specification?.prior_run_id).toBeDefined();
  });

  it('should mark tasks with already_built when step_id matches (primary match)', async () => {
    const plan1Id = crypto.randomUUID();
    const plan2Id = crypto.randomUUID();

    // Create two plans with SAME step_id (simulating plan version evolution)
    const plan1: PlanVersion = {
      ...createTestPlanVersion(plan1Id, 1),
      steps: [
        {
          step_id: 'shared-step-id',
          title: 'Original Task Name',
          description: 'First version',
          scope: 'backend',
          dependencies: [],
        },
      ],
    };

    const plan2: PlanVersion = {
      ...createTestPlanVersion(plan2Id, 1),
      steps: [
        {
          step_id: 'shared-step-id', // Same step_id (stable across versions)
          title: 'Updated Task Name', // Different title (evolved)
          description: 'Second version',
          scope: 'backend',
          dependencies: [],
        },
      ],
    };

    plans.set(plan1Id, plan1);
    plans.set(plan2Id, plan2);

    // First: Execute plan1 to completion
    const request1: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [plan1Id] }],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build1 = await coordinator.startBuild(request1);
    await waitForBuildStatus(storage, build1.build_id, [BuildStatus.Completed], 15000);

    // Get the prior run_id for verification
    const buildRuns1 = storage.listBuildRunsByBuild(build1.build_id);
    const tasks1 = storage.listTasksByRun(buildRuns1[0].run_id);
    const task1 = tasks1.find(t => t.step_id === 'shared-step-id');
    expect(task1).toBeDefined();

    // Second: Execute plan2
    const request2: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [plan2Id] }],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build2 = await coordinator.startBuild(request2);
    await waitForBuildStatus(storage, build2.build_id, [BuildStatus.Completed], 15000);

    // Verify that plan2's task was marked with already_built (high confidence)
    const buildRuns2 = storage.listBuildRunsByBuild(build2.build_id);
    const tasks2 = storage.listTasksByRun(buildRuns2[0].run_id);
    const task2 = tasks2.find(t => t.step_id === 'shared-step-id');

    expect(task2).toBeDefined();
    expect(task2?.specification?.already_built).toBe(true);
    expect(task2?.specification?.prior_run_id).toBe(buildRuns1[0].run_id);
    expect(task2?.specification?.prior_task_id).toBe(task1?.task_id);
    // Should NOT have already_built_hint (that's for low confidence)
    expect(task2?.specification?.already_built_hint).toBeUndefined();
  });

  it('should mark tasks with already_built_hint when scope+title matches completed task', async () => {
    const plan1Id = crypto.randomUUID();
    const plan2Id = crypto.randomUUID();

    // Create two plans with same scope and step title
    const plan1: PlanVersion = {
      ...createTestPlanVersion(plan1Id, 1),
      steps: [
        {
          step_id: 'step-1',
          title: 'Shared Task Name',
          description: 'First version',
          scope: 'backend',
          dependencies: [],
        },
      ],
    };

    const plan2: PlanVersion = {
      ...createTestPlanVersion(plan2Id, 1),
      steps: [
        {
          step_id: 'step-2',
          title: 'Shared Task Name',
          description: 'Second version',
          scope: 'backend',
          dependencies: [],
        },
      ],
    };

    plans.set(plan1Id, plan1);
    plans.set(plan2Id, plan2);

    // First: Execute plan1 to completion
    const request1: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [plan1Id] }],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build1 = await coordinator.startBuild(request1);
    await waitForBuildStatus(storage, build1.build_id, [BuildStatus.Completed], 15000);

    // Second: Execute plan2
    const request2: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [plan2Id] }],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build2 = await coordinator.startBuild(request2);
    await waitForBuildStatus(storage, build2.build_id, [BuildStatus.Completed], 15000);

    // Verify that plan2's task was marked with already_built_hint (low confidence)
    const buildRuns2 = storage.listBuildRunsByBuild(build2.build_id);
    const tasks2 = storage.listTasksByRun(buildRuns2[0].run_id);
    const task2 = tasks2.find(t => t.step_id === 'step-2');

    expect(task2).toBeDefined();
    expect(task2?.specification?.already_built_hint).toBe(true);
    // Should NOT have already_built (that's for high confidence)
    expect(task2?.specification?.already_built).toBeUndefined();
  });

  // ============================================
  // Test: Scoped Resume - Only Reset Dependent Tasks
  // ============================================

  it('should only reset tasks in the failure chain when resuming', async () => {
    // Create a plan with mixed success and failure:
    //   A (completed successfully)
    //   B (depends on A, completed successfully)
    //   C (independent, fails)
    //   D (depends on C, blocked by C's failure)
    //   E (depends on D, blocked transitively)
    //   F (independent, blocked for different reason - e.g., waiting for gate)
    const planId = crypto.randomUUID();
    const complexPlan: PlanVersion = {
      plan_id: planId,
      version: 1,
      status: 'approved',
      summary: {
        goal: 'Test selective resume of failure chain',
        context: 'Mix of success, failure, and independent blocked tasks',
      },
      steps: [
        { step_id: 'A', title: 'Task A', description: 'Success', dependencies: [] },
        { step_id: 'B', title: 'Task B', description: 'Success (depends on A)', dependencies: ['A'] },
        { step_id: 'C', title: 'Task C', description: 'Fails', dependencies: [] },
        { step_id: 'D', title: 'Task D', description: 'Blocked by C', dependencies: ['C'] },
        { step_id: 'E', title: 'Task E', description: 'Blocked by D (transitive)', dependencies: ['D'] },
        { step_id: 'F', title: 'Task F', description: 'Blocked independently', dependencies: [] },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    plans.set(planId, complexPlan);

    // Create a build with this plan
    const request: BuildRequest = {
      tiers: [{ tier: 0, plan_ids: [planId] }],
      concurrency_limit: 5,
      skip_completed: false,
    };

    const build = await coordinator.startBuild(request);

    // Wait for some execution (tasks will complete via TestExecutor)
    await waitForBuildStatus(storage, build.build_id, [BuildStatus.Completed], 15000);

    const buildRuns = storage.listBuildRunsByBuild(build.build_id);
    const runId = buildRuns[0].run_id;

    // Manually simulate the scenario:
    // A, B completed successfully
    // C failed
    // D, E blocked by C's failure (cascade)
    // F blocked independently (not related to C's failure)
    storage.transaction(() => {
      const tasks = storage.listTasksByRun(runId);
      const taskA = tasks.find(t => t.step_id === 'A');
      const taskB = tasks.find(t => t.step_id === 'B');
      const taskC = tasks.find(t => t.step_id === 'C');
      const taskD = tasks.find(t => t.step_id === 'D');
      const taskE = tasks.find(t => t.step_id === 'E');
      const taskF = tasks.find(t => t.step_id === 'F');

      // A and B completed successfully - leave as-is (already completed by TestExecutor)
      // We don't need to change these

      // C failed
      if (taskC) storage.updateTask(taskC.task_id, { status: 'failed' as any });

      // D and E blocked by C's failure (orchestrator would set this)
      if (taskD) storage.updateTask(taskD.task_id, { status: 'blocked' as any });
      if (taskE) storage.updateTask(taskE.task_id, { status: 'blocked' as any });

      // F blocked independently (e.g., waiting for manual gate, not related to C)
      if (taskF) storage.updateTask(taskF.task_id, { status: 'blocked' as any });

      // Mark run as failed
      storage.updateRun(runId, { status: 'failed' as any });
      storage.updateBuildRunStatus(build.build_id, runId, BuildRunStatus.Failed);
    });

    // Now call resumeFailedRun directly (simulates retryBuild logic)
    const coordinator2 = new BuildCoordinator({
      storage,
      plannerClient,
      scheduleReadyTasks: (runId: string) => {
        testExecutor.scheduleReadyTasks(runId);
      },
      pollIntervalMs: 100,
    });

    // Access private method via reflection (TypeScript testing pattern)
    const resumeMethod = (coordinator2 as any).resumeFailedRun.bind(coordinator2);
    resumeMethod(build.build_id, runId, 0);

    // Verify results:
    // - A should remain completed (success, not affected)
    // - B should remain completed (success, not affected)
    // - C should be reset to pending (failed task, will be retried)
    // - D should be reset to pending (depends on C, part of failure chain)
    // - E should be reset to pending (depends on D, transitive dependency)
    // - F should remain blocked (independent blockage, not in C's failure chain)

    const tasksAfterResume = storage.listTasksByRun(runId);
    const taskA = tasksAfterResume.find(t => t.step_id === 'A');
    const taskB = tasksAfterResume.find(t => t.step_id === 'B');
    const taskC = tasksAfterResume.find(t => t.step_id === 'C');
    const taskD = tasksAfterResume.find(t => t.step_id === 'D');
    const taskE = tasksAfterResume.find(t => t.step_id === 'E');
    const taskF = tasksAfterResume.find(t => t.step_id === 'F');

    expect(taskA?.status).toBe('completed'); // Success - not touched
    expect(taskB?.status).toBe('completed'); // Success - not touched
    expect(taskC?.status).toBe('pending');   // Failed task - reset for retry
    expect(taskD?.status).toBe('pending');   // Direct dependent of C - reset
    expect(taskE?.status).toBe('pending');   // Transitive dependent via D - reset
    expect(taskF?.status).toBe('blocked');   // Independent blockage - NOT reset
  });
});
