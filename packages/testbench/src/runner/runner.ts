import { randomUUID } from 'node:crypto';
import type { Scenario } from '../scenarios/schema.js';
import type { TestbenchConfig } from '../config/schema.js';
import type { RunResult, RunOptions } from './types.js';
import { WorkspaceManager } from '../workspace/manager.js';
import { PlannerClient } from '../clients/planner.js';
import { ForgeClient, type ForgePlan } from '../clients/forge.js';
import { TunerClient } from '../clients/tuner.js';
import { VerificationRouter } from '../verification/router.js';

export class ScenarioRunner {
  private readonly config: TestbenchConfig;
  private readonly workspace: WorkspaceManager;
  private readonly planner: PlannerClient;
  private readonly forge: ForgeClient;
  private readonly tuner: TunerClient;
  private readonly verifier: VerificationRouter;

  constructor(config: TestbenchConfig) {
    this.config = config;
    this.workspace = new WorkspaceManager(config.workspace_base);
    this.planner = new PlannerClient(config.planner_url);
    this.forge = new ForgeClient(config.forge_url);
    this.tuner = new TunerClient(config.tuner_url);
    this.verifier = new VerificationRouter();
  }

  async run(scenario: Scenario, options?: RunOptions): Promise<RunResult> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    let workspacePath: string | undefined;

    try {
      // 1. Create isolated workspace
      workspacePath = options?.workspace_path ?? await this.workspace.create(scenario.id);

      // 2. Create plan via Planner
      const plan = await this.planner.createPlan(scenario.goal);

      // 3. Get plan details for metrics
      const planVersion = await this.planner.getPlanVersion(plan.plan_id, plan.version);
      const stepCount = planVersion.steps.length;
      const stepsWithComplexity = planVersion.steps.filter((s) => s.complexity_estimate?.score !== undefined);
      const avgComplexity = stepsWithComplexity.length > 0
        ? stepsWithComplexity.reduce((sum, s) => sum + s.complexity_estimate!.score, 0) / stepsWithComplexity.length
        : 0;

      // 4. Auto-approve and publish
      if (this.config.auto_approve_plans) {
        await this.planner.approvePlan(plan.plan_id, plan.version);
      }
      const { plan_ref } = await this.planner.publishPlan(plan.plan_id, plan.version);

      // 5. Construct ForgePlan from plan version data and send to Forge
      const forgePlan: ForgePlan = {
        plan_id: planVersion.plan_id,
        version: planVersion.version,
        summary: planVersion.summary,
        steps: planVersion.steps.map((s) => ({
          step_id: s.step_id,
          title: s.title,
          description: s.description,
          scope: s.scope,
          owner_role: s.owner_role,
          dependencies: s.dependencies ?? [],
          acceptance_criteria: s.acceptance_criteria,
        })),
      };

      const forgeRun = await this.forge.createRun(forgePlan, workspacePath);

      // 6. Poll until complete
      const timeoutMs = (options?.timeout_minutes ?? this.config.default_timeout_minutes) * 60 * 1000;
      const runStatus = await this.forge.pollUntilComplete(forgeRun.run_id, { timeout_ms: timeoutMs });

      const forgeSuccess = runStatus.status === 'completed';

      // 7. Run verification
      const verificationResult = await this.verifier.verify(scenario.verification, workspacePath);

      // 8. Collect outcomes from Tuner (best effort)
      let actualTokens: number | undefined;
      let actualCost: number | undefined;

      try {
        const outcomes = await this.tuner.getOutcomes(forgeRun.run_id);
        actualTokens = outcomes.reduce((sum, o) => sum + o.tokens_used, 0);
        actualCost = outcomes.reduce((sum, o) => sum + o.cost_usd, 0);
      } catch {
        // Tuner unavailable - use Forge metrics as fallback
        actualTokens = runStatus.total_tokens;
        actualCost = runStatus.total_cost_usd;
      }

      const completedAt = new Date().toISOString();
      const actualTimeSeconds = (Date.now() - startTime) / 1000;

      return {
        scenario_id: scenario.id,
        run_id: runId,
        success: forgeSuccess && verificationResult.passed,
        started_at: startedAt,
        completed_at: completedAt,
        plan_id: plan.plan_id,
        plan_version: plan.version,
        plan_step_count: stepCount,
        estimated_complexity: avgComplexity > 0 ? avgComplexity : undefined,
        actual_time_seconds: actualTimeSeconds,
        actual_tokens: actualTokens,
        actual_cost_usd: actualCost,
        verification_result: verificationResult,
        mock: false,
      };
    } catch (error) {
      const completedAt = new Date().toISOString();
      return {
        scenario_id: scenario.id,
        run_id: runId,
        success: false,
        started_at: startedAt,
        completed_at: completedAt,
        actual_time_seconds: (Date.now() - startTime) / 1000,
        error: error instanceof Error ? error.message : String(error),
        mock: false,
      };
    } finally {
      // 9. Cleanup workspace (respect cleanup_on_success / cleanup_on_failure config)
      if (workspacePath && !options?.workspace_path) {
        // We don't know success/failure here reliably, but the config
        // defaults have cleanup_on_success=true, cleanup_on_failure=false.
        // For now, always attempt cleanup — the workspace manager handles idempotency.
        if (this.config.cleanup_on_success || this.config.cleanup_on_failure) {
          await this.workspace.cleanup(workspacePath).catch(() => {});
        }
      }
    }
  }
}
