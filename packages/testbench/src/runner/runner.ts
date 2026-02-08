import { randomUUID } from 'node:crypto';
import type { Scenario } from '../scenarios/schema.js';
import type { TestbenchConfig } from '../config/schema.js';
import type { RunResult, RunOptions, IdeationMetrics } from './types.js';
import { WorkspaceManager } from '../workspace/manager.js';
import { PlannerClient, type PlanVersionResult, type Step } from '../clients/planner.js';
import { ForgeClient, type ForgePlan } from '../clients/forge.js';
import { TunerClient } from '../clients/tuner.js';
import { VerificationRouter } from '../verification/router.js';
import { IdeationClient } from '../clients/ideation.js';

/**
 * Generate simple test steps from a scenario.
 * In test mode, these provide structure for the forge task DAG
 * without needing AI-generated plans.
 */
function generateTestSteps(scenario: Scenario): Step[] {
  const stepCount = scenario.expected?.step_count?.max ?? 2;
  const steps: Step[] = [];

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
  private readonly ideation: IdeationClient;

  constructor(config: TestbenchConfig) {
    this.config = config;
    this.workspace = new WorkspaceManager(config.workspace_base);
    this.planner = new PlannerClient(config.planner_url);
    this.forge = new ForgeClient(config.forge_url);
    this.tuner = new TunerClient(config.tuner_url);
    this.verifier = new VerificationRouter();
    const ideationUrl = config.ideation_url ?? `${config.planner_url}/api/ideation`;
    this.ideation = new IdeationClient(ideationUrl);
  }

  async run(scenario: Scenario, options?: RunOptions): Promise<RunResult> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    let workspacePath: string | undefined;

    try {
      // 1. Create isolated workspace
      workspacePath = options?.workspace_path ?? await this.workspace.create(scenario.id);

      // 2. Create plan — via ideation handoff or direct planner call
      let ideationMetrics: IdeationMetrics | undefined;
      let planId: string;

      if (scenario.ideation) {
        const ideationResult = await this.runIdeation(scenario);
        ideationMetrics = ideationResult.metrics;
        planId = ideationResult.plan_id;
        console.log(`  Ideation complete: plan ${planId} v${ideationResult.plan_version} created`);
      } else {
        const plan = await this.planner.createPlan(scenario.goal);
        planId = plan.plan_id;
      }

      // 3. Generate steps: AI strategy waits for PlannerLead, hardcoded strategy uses predefined steps
      //    This applies regardless of whether ideation was used — ideation creates the plan
      //    with understanding but without steps.
      let activeVersion: number;
      let activePlanVersion: PlanVersionResult;

      if (scenario.planning_strategy === 'ai') {
        // AI strategy: wait for PlannerLead to generate steps via add_step tool
        console.log('  Waiting for PlannerLead to generate steps...');
        activePlanVersion = await this.planner.waitForSteps(planId, {
          timeout_ms: 90_000,
        });
        activeVersion = activePlanVersion.version;
        console.log(`  PlannerLead generated ${activePlanVersion.steps.length} steps (version ${activeVersion})`);
      } else {
        // Hardcoded strategy: generate predefined test steps
        const testSteps = generateTestSteps(scenario);
        const updated = await this.planner.updatePlanSteps(planId, testSteps);
        activeVersion = updated.version;
        activePlanVersion = await this.planner.getPlanVersion(planId, activeVersion);
      }

      // 4. Calculate plan metrics
      const stepCount = activePlanVersion.steps.length;
      const stepsWithComplexity = activePlanVersion.steps.filter((s) => s.complexity_estimate?.score !== undefined);
      const avgComplexity = stepsWithComplexity.length > 0
        ? stepsWithComplexity.reduce((sum, s) => sum + s.complexity_estimate!.score, 0) / stepsWithComplexity.length
        : 0;

      // 5. Auto-approve and publish
      if (this.config.auto_approve_plans) {
        await this.planner.approvePlan(planId, activeVersion);
      }
      const { plan_ref } = await this.planner.publishPlan(planId, activeVersion);

      // 6. Construct ForgePlan from plan version data and send to Forge
      const forgePlan: ForgePlan = {
        plan_id: activePlanVersion.plan_id,
        version: activePlanVersion.version,
        summary: activePlanVersion.summary,
        steps: activePlanVersion.steps.map((s) => ({
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

      // Track setup time (everything before forge execution)
      const setupTimeSeconds = (Date.now() - startTime) / 1000;
      const executionStartTime = Date.now();

      // 7. Poll until complete
      const timeoutMs = (options?.timeout_minutes ?? this.config.default_timeout_minutes) * 60 * 1000;
      const runStatus = await this.forge.pollUntilComplete(forgeRun.run_id, { timeout_ms: timeoutMs });

      const forgeSuccess = runStatus.status === 'completed';

      // Track execution time (forge run only)
      const executionTimeSeconds = (Date.now() - executionStartTime) / 1000;

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
        plan_id: planId,
        plan_version: activeVersion,
        plan_step_count: stepCount,
        estimated_complexity: avgComplexity > 0 ? avgComplexity : undefined,
        actual_time_seconds: actualTimeSeconds,
        setup_time_seconds: setupTimeSeconds,
        execution_time_seconds: executionTimeSeconds,
        actual_tokens: actualTokens,
        actual_cost_usd: actualCost,
        ideation_metrics: ideationMetrics,
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

  /**
   * Execute ideation flow for a scenario.
   * Returns plan_id, plan_version, and metrics after ideation completes.
   */
  private async runIdeation(scenario: Scenario): Promise<{
    plan_id: string;
    plan_version: number;
    metrics: IdeationMetrics;
  }> {
    if (!scenario.ideation) {
      throw new Error('runIdeation called but scenario.ideation is undefined');
    }

    const ideationConfig = scenario.ideation;
    const startTime = Date.now();

    // 1. Create ideation session
    console.log('  Creating ideation session...');
    const session = await this.ideation.createSession(scenario.goal);
    console.log(`  Ideation session created: ${session.id}`);

    // 2. Populate understanding and blocks (preconfigured strategy)
    if (ideationConfig.ideation_strategy === 'preconfigured') {
      // Add understanding from config
      if (ideationConfig.understanding) {
        for (const [specialist, observations] of Object.entries(ideationConfig.understanding)) {
          console.log(`  Adding understanding for specialist: ${specialist}`);
          await this.ideation.updateUnderstanding(session.id, specialist, observations);
        }
      }

      // Create and curate blocks from config
      if (ideationConfig.blocks) {
        for (const blockInput of ideationConfig.blocks) {
          console.log(`  Creating block: ${blockInput.title}`);
          const { id } = await this.ideation.createBlock(session.id, blockInput);
          console.log(`  Curating block: ${id}`);
          await this.ideation.curateBlock(session.id, id);
        }
      }
    }

    // 3. AI strategy: send messages and wait for understanding
    if (ideationConfig.ideation_strategy === 'ai') {
      const messages = ideationConfig.messages ?? [scenario.goal];

      for (const content of messages) {
        console.log(`  Sending message to ideation session...`);
        await this.ideation.addMessage(session.id, 'user', content);
      }

      console.log('  Waiting for understanding...');
      await this.ideation.waitForUnderstanding(session.id, {
        timeout_ms: ideationConfig.timeout_ms,
        min_specialists: 1,
      });
      console.log('  Understanding received from specialists');
    }

    // 4. Send to planner
    console.log('  Sending ideation to planner...');
    const handoffOptions = {
      goal: ideationConfig.handoff_goal,
      context: ideationConfig.handoff_context,
    };
    const sendResult = await this.ideation.sendToPlanner(session.id, handoffOptions);
    console.log(`  Plan created: ${sendResult.plan_id} v${sendResult.plan_version}`);

    // 5. Get final session state for metrics
    const finalSession = await this.ideation.getSession(session.id);
    const ideationTimeMs = Date.now() - startTime;

    const curatedBlocks = finalSession.blocks.filter((b) => b.status === 'curated');

    const metrics: IdeationMetrics = {
      session_id: finalSession.id,
      specialist_count: Object.keys(finalSession.understanding).length,
      understanding_keys: Object.keys(finalSession.understanding),
      block_count: finalSession.blocks.length,
      curated_block_count: curatedBlocks.length,
      ideation_time_ms: ideationTimeMs,
      handoff_plan_id: sendResult.plan_id,
      handoff_plan_version: sendResult.plan_version,
      ideation_strategy: ideationConfig.ideation_strategy,
    };

    return {
      plan_id: sendResult.plan_id,
      plan_version: sendResult.plan_version,
      metrics,
    };
  }
}
