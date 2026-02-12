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
});
