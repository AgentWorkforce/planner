import { randomUUID } from 'node:crypto';
import type { Scenario } from '../scenarios/schema.js';
import type { TestbenchConfig } from '../config/schema.js';
import type { RunResult, RunOptions } from './types.js';
import { WorkspaceManager } from '../workspace/manager.js';
import { PlannerClient, type PlanStep, type PlanVersionResult } from '../clients/planner.js';
import { ForgeClient, type ForgePlan } from '../clients/forge.js';
import { TunerClient } from '../clients/tuner.js';
import { VerificationRouter } from '../verification/router.js';

/**
 * Generate simple test steps from a scenario.
 * In test mode, these provide structure for the forge task DAG
 * without needing AI-generated plans.
 */
function generateTestSteps(scenario: Scenario): PlanStep[] {
  const stepCount = scenario.expected?.step_count?.max ?? 2;
  const steps: PlanStep[] = [];

  if (stepCount <= 1) {
    steps.push({
      step_id: randomUUID(),
      title: 'Implement solution',
      description: scenario.goal,
      owner_role: 'Coder',
    });
  } else {
    const implId = randomUUID();
    steps.push({
      step_id: implId,
      title: 'Implement solution',
      description: scenario.goal,
      owner_role: 'Coder',
    });
    steps.push({
      step_id: randomUUID(),
      title: 'Verify implementation',
      description: `Verify the solution meets requirements: ${scenario.goal}`,
      owner_role: 'Reviewer',
      dependencies: [implId],
    });
  }

  return steps;
}

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

      // 2. Create plan via Planner (starts with empty steps)
      const plan = await this.planner.createPlan(scenario.goal);

      // 3. Generate steps: AI mode waits for PlannerLead, synthetic mode uses hardcoded steps
      let activeVersion: number;
      let planVersion: PlanVersionResult;

      if (scenario.planning_mode === 'ai') {
        // AI mode: wait for PlannerLead to generate steps via add_step tool
        console.log('  Waiting for PlannerLead to generate steps...');
        planVersion = await this.planner.waitForSteps(plan.plan_id, {
          timeout_ms: 90_000,
        });
        activeVersion = planVersion.version;
        console.log(`  PlannerLead generated ${planVersion.steps.length} steps (version ${activeVersion})`);
      } else {
        // Synthetic mode: generate hardcoded test steps (current behavior)
        const testSteps = generateTestSteps(scenario);
        const updated = await this.planner.updatePlanSteps(plan.plan_id, testSteps);
        activeVersion = updated.version;
        planVersion = await this.planner.getPlanVersion(plan.plan_id, activeVersion);
      }

      // 4. Calculate plan metrics
      const stepCount = planVersion.steps.length;
      const stepsWithComplexity = planVersion.steps.filter((s) => s.complexity_estimate?.score !== undefined);
      const avgComplexity = stepsWithComplexity.length > 0
        ? stepsWithComplexity.reduce((sum, s) => sum + s.complexity_estimate!.score, 0) / stepsWithComplexity.length
        : 0;

      // 5. Auto-approve and publish
      if (this.config.auto_approve_plans) {
        await this.planner.approvePlan(plan.plan_id, activeVersion);
      }
      const { plan_ref } = await this.planner.publishPlan(plan.plan_id, activeVersion);

      // 6. Construct ForgePlan from plan version data and send to Forge
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

      // 7. Poll until complete
      const timeoutMs = (options?.timeout_minutes ?? this.config.default_timeout_minutes) * 60 * 1000;
      const runStatus = await this.forge.pollUntilComplete(forgeRun.run_id, { timeout_ms: timeoutMs });

      const forgeSuccess = runStatus.status === 'completed';

      // 8. Run verification
      const verificationResult = await this.verifier.verify(scenario.verification, workspacePath);

      // 9. Collect outcomes from Tuner (best effort)
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
        plan_version: activeVersion,
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
      // 10. Cleanup workspace (respect cleanup_on_success / cleanup_on_failure config)
      if (workspacePath && !options?.workspace_path) {
        if (this.config.cleanup_on_success || this.config.cleanup_on_failure) {
          await this.workspace.cleanup(workspacePath).catch(() => {});
        }
      }
    }
  }
}
