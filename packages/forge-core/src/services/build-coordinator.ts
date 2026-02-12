/**
 * BuildCoordinator — Tiered Multi-Plan Build Execution
 *
 * Sits above the Orchestrator. Accepts a BuildRequest (tiers of plan_ids),
 * creates a Build entity, and executes tiers sequentially:
 *   - For each tier: create Runs for all plans, start them with concurrency limits
 *   - Wait for all runs in the tier to complete before advancing
 *   - Track BuildRun status for each (build, run) pair
 *
 * Supports pause/resume/cancel at the build level.
 */

import type { ForgeStorage } from '../storage/interface.js';
import type { PlannerClient } from '../adapters/planner-client.js';
import type { ForgeConfig } from '../config/forge-config.js';
import { createDefaultConfig } from '../config/forge-config.js';
import { transformToForgePlan } from '../adapters/plan-transformer.js';
import type { TrajectoryCapture } from './trajectory-capture.js';
import type { WorktreeManager } from './worktree-manager.js';
import { TrajectoryEventType } from '../domain/trajectory-events.js';
import {
  type BuildRequest,
  type Build,
  type BuildRun,
  BuildStatus,
  BuildRunStatus,
  createBuild,
  createBuildRun,
  validateBuildTransition,
} from '../domain/build-types.js';
import {
  createRun,
  createTask,
  RunStatus,
  TaskStatus,
  type Task,
} from '../domain/types.js';

// ============================================
// Configuration
// ============================================

export interface BuildCoordinatorConfig {
  storage: ForgeStorage;
  plannerClient: PlannerClient;
  /** Callback to start run execution (from Orchestrator or TestExecutor) */
  scheduleReadyTasks: (runId: string) => void;
  /** Callback to register a run as part of a build for cross-run scope coordination */
  registerBuildRun?: (buildId: string, runId: string) => void;
  /** Callback to terminate all agents for a run (from Orchestrator) */
  terminateRunAgents?: (runId: string) => void;
  forgeConfig?: ForgeConfig;
  trajectoryCapture?: TrajectoryCapture;
  /** Polling interval for checking run completions (ms, default: 3000) */
  pollIntervalMs?: number;
  /** WorktreeManager for git worktree isolation (optional) */
  worktreeManager?: WorktreeManager;
}

// ============================================
// BuildCoordinator
// ============================================

export class BuildCoordinator {
  private storage: ForgeStorage;
  private plannerClient: PlannerClient;
  private scheduleReadyTasks: (runId: string) => void;
  private registerBuildRun?: (buildId: string, runId: string) => void;
  private terminateRunAgents?: (runId: string) => void;
  private forgeConfig: ForgeConfig;
  private trajectoryCapture?: TrajectoryCapture;
  private pollIntervalMs: number;
  private worktreeManager?: WorktreeManager;

  /** Active build loops — prevents duplicate execution */
  private activeBuildLoops = new Set<string>();
  /** Track worktree paths per build for cleanup */
  private buildWorktrees = new Map<string, string>();

  constructor(config: BuildCoordinatorConfig) {
    this.storage = config.storage;
    this.plannerClient = config.plannerClient;
    this.scheduleReadyTasks = config.scheduleReadyTasks;
    this.registerBuildRun = config.registerBuildRun;
    this.terminateRunAgents = config.terminateRunAgents;
    this.forgeConfig = config.forgeConfig ?? createDefaultConfig();
    this.trajectoryCapture = config.trajectoryCapture;
    this.pollIntervalMs = config.pollIntervalMs ?? 3000;
    this.worktreeManager = config.worktreeManager;
  }

  /**
   * Start a new build from a BuildRequest.
   * Creates the Build entity and kicks off async execution.
   * Returns the created Build immediately.
   */
  async startBuild(request: BuildRequest): Promise<Build> {
    // Dedup: reject if same plan set already has an active build (pending/running)
    const activeBuilds = [
      ...this.storage.listBuilds(BuildStatus.Pending),
      ...this.storage.listBuilds(BuildStatus.Running),
    ];
    const requestPlanIds = request.tiers
      .flatMap((t) => t.plan_ids)
      .sort()
      .join(',');
    for (const existing of activeBuilds) {
      const existingPlanIds = existing.tiers
        .flatMap((t) => t.plan_ids)
        .sort()
        .join(',');
      if (existingPlanIds === requestPlanIds) {
        console.log(
          `[BuildCoordinator] Dedup: returning existing build ${existing.build_id} (same plan set already active)`
        );
        return existing;
      }
    }

    const build = createBuild(request);
    this.storage.createBuild(build);

    console.log(
      `[BuildCoordinator] Created build ${build.build_id} with ${request.tiers.length} tiers, ` +
      `${request.tiers.reduce((sum, t) => sum + t.plan_ids.length, 0)} plans total`
    );

    // Execute in background
    this.executeBuild(build.build_id).catch((err) => {
      console.error(`[BuildCoordinator] Fatal error in build ${build.build_id}:`, err);
      this.failBuild(build.build_id, err instanceof Error ? err.message : String(err));
    });

    return build;
  }

  /**
   * Pause a running build. Stops dispatching new tier runs.
   * Already-running runs continue to completion.
   */
  pauseBuild(buildId: string): Build | null {
    const build = this.storage.getBuild(buildId);
    if (!build) return null;

    validateBuildTransition(build.status, BuildStatus.Paused);
    return this.storage.updateBuild(buildId, { status: BuildStatus.Paused });
  }

  /**
   * Resume a paused build. Re-enters the execution loop.
   */
  resumeBuild(buildId: string): Build | null {
    const build = this.storage.getBuild(buildId);
    if (!build) return null;

    validateBuildTransition(build.status, BuildStatus.Running);
    const updated = this.storage.updateBuild(buildId, { status: BuildStatus.Running });

    // Re-kick the execution loop if not already active
    if (!this.activeBuildLoops.has(buildId)) {
      this.executeBuild(buildId).catch((err) => {
        console.error(`[BuildCoordinator] Fatal error resuming build ${buildId}:`, err);
        this.failBuild(buildId, err instanceof Error ? err.message : String(err));
      });
    }

    return updated;
  }

  /**
   * Retry a failed build. Re-executes failed runs, skips completed ones.
   * Reuses the existing worktree — completed task commits are preserved.
   */
  retryBuild(buildId: string): Build | null {
    const build = this.storage.getBuild(buildId);
    if (!build) return null;

    validateBuildTransition(build.status, BuildStatus.Running);

    const updated = this.storage.updateBuild(buildId, {
      status: BuildStatus.Running,
      skip_completed: true, // Don't re-run what succeeded
      error: null,
      completed_at: null,
    });

    console.log(
      `[BuildCoordinator] Retrying build ${buildId} ` +
      `(worktree: ${build.workspace_path ?? 'none'})`
    );

    // Re-kick the execution loop
    if (!this.activeBuildLoops.has(buildId)) {
      this.executeBuild(buildId).catch((err) => {
        console.error(`[BuildCoordinator] Fatal error retrying build ${buildId}:`, err);
        this.failBuild(buildId, err instanceof Error ? err.message : String(err));
      });
    }

    return updated;
  }

  /**
   * Cancel a build. Marks build and all pending BuildRuns as cancelled.
   */
  cancelBuild(buildId: string): Build | null {
    const build = this.storage.getBuild(buildId);
    if (!build) return null;

    validateBuildTransition(build.status, BuildStatus.Cancelled);

    // Terminate agents for all running runs BEFORE updating DB status
    const buildRuns = this.storage.listBuildRunsByBuild(buildId);
    for (const br of buildRuns) {
      if (br.status === BuildRunStatus.Running && this.terminateRunAgents) {
        this.terminateRunAgents(br.run_id);
      }
    }

    // Remove from active loops so executeBuild exits
    this.activeBuildLoops.delete(buildId);

    return this.storage.transaction(() => {
      // Cancel all pending/running BuildRuns
      for (const br of buildRuns) {
        if (br.status === BuildRunStatus.Pending || br.status === BuildRunStatus.Running) {
          this.storage.updateBuildRunStatus(buildId, br.run_id, BuildRunStatus.Failed);
        }
      }

      return this.storage.updateBuild(buildId, { status: BuildStatus.Cancelled })!;
    });
  }

  /**
   * Get a build with its runs.
   */
  getBuildWithRuns(buildId: string): { build: Build; runs: BuildRun[] } | null {
    const build = this.storage.getBuild(buildId);
    if (!build) return null;
    const runs = this.storage.listBuildRunsByBuild(buildId);
    return { build, runs };
  }

  // ============================================
  // Private: Execution Loop
  // ============================================

  /**
   * Core build execution loop. Processes tiers sequentially.
   */
  private async executeBuild(buildId: string): Promise<void> {
    // Guard against duplicate loops
    if (this.activeBuildLoops.has(buildId)) {
      console.log(`[BuildCoordinator] Build ${buildId} already has active loop`);
      return;
    }
    this.activeBuildLoops.add(buildId);

    try {
      const build = this.storage.getBuild(buildId);
      if (!build) throw new Error(`Build ${buildId} not found`);

      // Transition to running
      if (build.status === BuildStatus.Pending) {
        this.storage.updateBuild(buildId, {
          status: BuildStatus.Running,
          started_at: new Date().toISOString(),
        });
      }

      // Create or reuse build-level worktree — all runs in this build share one isolated checkout
      let buildWorktreePath: string | undefined = build.workspace_path ?? undefined;

      if (buildWorktreePath) {
        // Reuse existing worktree (retry/resume case — completed commits already here)
        this.buildWorktrees.set(buildId, buildWorktreePath);
        console.log(`[BuildCoordinator] Build ${buildId} reusing worktree at ${buildWorktreePath}`);
      } else if (this.worktreeManager) {
        try {
          buildWorktreePath = await this.worktreeManager.createForBuild(buildId);
          this.buildWorktrees.set(buildId, buildWorktreePath);
          // Persist to DB so the API can return it to the user
          this.storage.updateBuild(buildId, { workspace_path: buildWorktreePath });
          console.log(`[BuildCoordinator] Build ${buildId} using new worktree at ${buildWorktreePath}`);
        } catch (err) {
          console.error(`[BuildCoordinator] Failed to create worktree for build ${buildId}:`, err);
          // Continue without worktree — falls back to workspace_path from request
        }
      }

      // Sort tiers by tier number
      const sortedTiers = [...build.tiers].sort((a, b) => a.tier - b.tier);

      // Find which tier to start from (support resume — skip completed tiers)
      for (const tier of sortedTiers) {
        // Check if build is still running (might be paused/cancelled)
        const currentBuild = this.storage.getBuild(buildId);
        if (!currentBuild || currentBuild.status !== BuildStatus.Running) {
          console.log(`[BuildCoordinator] Build ${buildId} is ${currentBuild?.status}, stopping`);
          return;
        }

        console.log(
          `[BuildCoordinator] Executing tier ${tier.tier} with ${tier.plan_ids.length} plans`
        );

        // Create runs for all plans in this tier
        const tierRunIds = await this.createTierRuns(buildId, tier.tier, tier.plan_ids, build, buildWorktreePath);

        if (tierRunIds.length === 0) {
          console.log(`[BuildCoordinator] Tier ${tier.tier} has no runs to execute, skipping`);
          continue;
        }

        // Start all runs (respecting concurrency limit via the orchestrator)
        for (const runId of tierRunIds) {
          this.scheduleReadyTasks(runId);
        }

        // Wait for all runs in this tier to complete
        const tierSuccess = await this.waitForTier(buildId, tier.tier);

        if (!tierSuccess) {
          // Check if the build was paused/cancelled (not a tier failure)
          const currentStatus = this.storage.getBuild(buildId)?.status;
          if (currentStatus === BuildStatus.Paused || currentStatus === BuildStatus.Cancelled) {
            console.log(
              `[BuildCoordinator] Build ${buildId} was ${currentStatus} during tier ${tier.tier}`
            );
            return;
          }

          // Actual tier failure — runs failed
          const failedRuns = this.storage.listBuildRunsByTier(buildId, tier.tier)
            .filter(br => br.status === BuildRunStatus.Failed);

          console.error(
            `[BuildCoordinator] Tier ${tier.tier} failed: ${failedRuns.length} runs failed`
          );

          this.failBuild(
            buildId,
            `Tier ${tier.tier} failed: ${failedRuns.length}/${tier.plan_ids.length} runs failed`
          );
          return;
        }

        console.log(`[BuildCoordinator] Tier ${tier.tier} completed successfully`);
      }

      // All tiers completed
      this.completeBuild(buildId);
    } finally {
      this.activeBuildLoops.delete(buildId);
    }
  }

  /**
   * Creates Runs for all plan_ids in a tier.
   * Returns the run_ids of the created runs.
   */
  private async createTierRuns(
    buildId: string,
    tier: number,
    planIds: string[],
    build: Build,
    buildWorktreePath?: string
  ): Promise<string[]> {
    const runIds: string[] = [];

    for (const planId of planIds) {
      try {
        // Check existing BuildRuns for this plan (resume/retry case)
        const existingBuildRuns = this.storage.listBuildRunsByTier(buildId, tier);
        const existingForPlan = existingBuildRuns.filter(br => br.plan_id === planId);

        // 1. Skip completed plans (no need to re-execute)
        if (existingForPlan.length > 0) {
          const completedRun = existingForPlan.find(br => br.status === BuildRunStatus.Completed);
          if (completedRun && build.skip_completed) {
            console.log(
              `[BuildCoordinator] Skipping completed plan ${planId} in tier ${tier}`
            );
            continue;
          }

          // 2. Reuse active run (already in progress)
          const activeRun = existingForPlan.find(
            br => br.status === BuildRunStatus.Running || br.status === BuildRunStatus.Pending
          );
          if (activeRun) {
            runIds.push(activeRun.run_id);
            continue;
          }

          // 3. Resume the run with the most completed tasks
          const resumableCandidates = existingForPlan
            .filter(br => br.status === BuildRunStatus.Failed || br.status === BuildRunStatus.Skipped)
            .map(br => {
              const tasks = this.storage.listTasksByRun(br.run_id);
              return { br, completedCount: tasks.filter(t => t.status === TaskStatus.Completed).length };
            })
            .sort((a, b) => b.completedCount - a.completedCount);

          const bestCandidate = resumableCandidates[0];
          if (bestCandidate) {
            const resumedRunId = this.resumeFailedRun(buildId, bestCandidate.br.run_id, tier);
            if (resumedRunId) {
              // Mark other candidates as skipped so waitForTier ignores them
              for (const other of resumableCandidates.slice(1)) {
                if (other.br.status !== BuildRunStatus.Skipped) {
                  this.storage.updateBuildRunStatus(buildId, other.br.run_id, BuildRunStatus.Skipped);
                }
              }
              runIds.push(resumedRunId);
              continue;
            }
            // If resume failed, fall through to create a new run
          }
        }

        // 4. No existing run — create fresh
        const runId = await this.createFreshRun(buildId, planId, tier, build, buildWorktreePath);
        runIds.push(runId);

        console.log(
          `[BuildCoordinator] Created run ${runId} for plan ${planId} (tier ${tier})`
        );
      } catch (err) {
        console.error(
          `[BuildCoordinator] Failed to create run for plan ${planId}:`,
          err
        );
        throw new Error(
          `Failed to create run for plan ${planId}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return runIds;
  }

  /**
   * Resume a failed run: reset failed/pending tasks back to pending,
   * keep completed tasks as-is, transition run back to running.
   */
  private resumeFailedRun(buildId: string, runId: string, tier: number): string | null {
    try {
      const tasks = this.storage.listTasksByRun(runId);
      const completedCount = tasks.filter(t => t.status === TaskStatus.Completed).length;
      const failedCount = tasks.filter(t => t.status === TaskStatus.Failed).length;
      const pendingCount = tasks.filter(t =>
        t.status === TaskStatus.Pending || t.status === TaskStatus.Blocked
      ).length;

      if (completedCount === 0 && failedCount === 0) {
        // Nothing to resume — empty run, just create fresh
        return null;
      }

      this.storage.transaction(() => {
        // Reset failed tasks back to pending
        for (const task of tasks) {
          if (task.status === TaskStatus.Failed) {
            this.storage.updateTask(task.task_id, { status: TaskStatus.Pending });
          }
          // Also reset blocked tasks that may have been blocked by the failed ones
          if (task.status === TaskStatus.Blocked) {
            this.storage.updateTask(task.task_id, { status: TaskStatus.Pending });
          }
        }

        // Transition run from failed → running (clear completed_at and error)
        this.storage.updateRun(runId, {
          status: RunStatus.Running,
          completed_at: undefined,
          error: undefined,
        });

        // Update BuildRun status to running
        this.storage.updateBuildRunStatus(buildId, runId, BuildRunStatus.Running);
      });

      // Register for cross-run scope coordination
      this.registerBuildRun?.(buildId, runId);

      console.log(
        `[BuildCoordinator] Resuming run ${runId} (${completedCount} completed, ` +
        `${failedCount} failed→pending, ${pendingCount} pending)`
      );

      return runId;
    } catch (err) {
      console.error(`[BuildCoordinator] Failed to resume run ${runId}:`, err);
      return null;
    }
  }

  /**
   * Create a brand new run from a plan version (no prior attempts exist).
   */
  private async createFreshRun(
    buildId: string,
    planId: string,
    tier: number,
    build: Build,
    buildWorktreePath?: string
  ): Promise<string> {
    // Fetch plan from Planner
    const planVersion = await this.plannerClient.fetchPlanVersion(planId);

    // Transform to ForgePlan
    const { plan: forgePlan, warnings } = transformToForgePlan(
      planVersion,
      this.forgeConfig
    );

    if (warnings.length > 0) {
      console.warn(
        `[BuildCoordinator] Plan ${planId} transform warnings:`,
        warnings.map(w => w.message)
      );
    }

    // Create Run + Tasks + BuildRun in a transaction
    const runId = this.storage.transaction(() => {
      const workspacePath = buildWorktreePath ?? build.workspace_path ?? undefined;
      const run = createRun(forgePlan, { workspacePath });
      this.storage.createRun(run);

      // Store plan context/understanding in run document
      const planDoc: Record<string, unknown> = {};
      if (forgePlan.context) planDoc.context = forgePlan.context;
      if (forgePlan.understanding) planDoc.understanding = forgePlan.understanding;
      if (Object.keys(planDoc).length > 0) {
        this.storage.setRunDocument(run.run_id, planDoc);
      }

      // Create tasks
      for (const step of forgePlan.steps) {
        const task = createTask(run.run_id, step, workspacePath);
        this.storage.createTask(task);
      }

      // Create BuildRun link
      const buildRun = createBuildRun({
        build_id: buildId,
        run_id: run.run_id,
        plan_id: planId,
        plan_version: planVersion.version,
        tier,
      });
      this.storage.createBuildRun(buildRun);

      return run.run_id;
    });

    // Register for cross-run scope coordination
    this.registerBuildRun?.(buildId, runId);

    return runId;
  }

  /**
   * Polls until all runs in a tier are complete (or any fail).
   * Returns true if all succeeded, false if any failed.
   */
  private async waitForTier(buildId: string, tier: number): Promise<boolean> {
    while (true) {
      // Check if build is still running
      const build = this.storage.getBuild(buildId);
      if (!build || build.status !== BuildStatus.Running) {
        return false;
      }

      const tierRuns = this.storage.listBuildRunsByTier(buildId, tier);

      // Update BuildRun statuses from actual Run statuses
      let allDone = true;
      let anyFailed = false;

      for (const br of tierRuns) {
        if (br.status === BuildRunStatus.Completed || br.status === BuildRunStatus.Skipped) {
          continue; // Already done
        }

        // Check the actual run status
        const run = this.storage.getRun(br.run_id);
        if (!run) {
          this.storage.updateBuildRunStatus(buildId, br.run_id, BuildRunStatus.Failed);
          anyFailed = true;
          continue;
        }

        if (run.status === RunStatus.Completed) {
          this.storage.updateBuildRunStatus(buildId, br.run_id, BuildRunStatus.Completed);
        } else if (run.status === RunStatus.Failed || run.status === RunStatus.Cancelled) {
          this.storage.updateBuildRunStatus(buildId, br.run_id, BuildRunStatus.Failed);
          anyFailed = true;
        } else if (run.status === RunStatus.Running || run.status === RunStatus.Pending) {
          // Sync BuildRun status
          if (br.status !== BuildRunStatus.Running) {
            this.storage.updateBuildRunStatus(buildId, br.run_id, BuildRunStatus.Running);
          }
          allDone = false;
        } else {
          allDone = false;
        }
      }

      if (anyFailed) return false;
      if (allDone) return true;

      await this.delay(this.pollIntervalMs);
    }
  }

  // ============================================
  // Private: Build State Management
  // ============================================

  private completeBuild(buildId: string): void {
    const now = new Date().toISOString();
    this.storage.updateBuild(buildId, {
      status: BuildStatus.Completed,
      completed_at: now,
    });

    const build = this.storage.getBuild(buildId);
    const buildRuns = this.storage.listBuildRunsByBuild(buildId);
    const completedCount = buildRuns.filter(br => br.status === BuildRunStatus.Completed).length;

    console.log(
      `[BuildCoordinator] Build ${buildId} completed: ${completedCount}/${buildRuns.length} runs succeeded`
    );

    const worktreePath = this.buildWorktrees.get(buildId);
    if (worktreePath) {
      console.log(`[BuildCoordinator] Build ${buildId} complete. Worktree preserved at ${worktreePath}`);
      console.log(`[BuildCoordinator] Review changes: cd ${worktreePath} && git diff`);
    }
    this.buildWorktrees.delete(buildId);
  }

  private failBuild(buildId: string, error: string): void {
    this.storage.updateBuild(buildId, {
      status: BuildStatus.Failed,
      error,
      completed_at: new Date().toISOString(),
    });
    console.error(`[BuildCoordinator] Build ${buildId} failed: ${error}`);

    const worktreePath = this.buildWorktrees.get(buildId);
    if (worktreePath) {
      // Preserve worktree for retry/inspection — completed task commits live here
      console.log(`[BuildCoordinator] Build ${buildId} worktree preserved at ${worktreePath}`);
      console.log(`[BuildCoordinator] Retry: POST /builds/${buildId}/retry`);
    }
    this.buildWorktrees.delete(buildId);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Factory
// ============================================

export function createBuildCoordinator(config: BuildCoordinatorConfig): BuildCoordinator {
  return new BuildCoordinator(config);
}
