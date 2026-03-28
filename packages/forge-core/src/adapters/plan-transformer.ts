import type { ForgePlan, ForgeStep, AcceptanceCriterion, GateConfig } from '../domain/types.js';
import type { PlanVersion, PlannerStep } from './planner-client.js';
import {
  type ForgeConfig,
  resolveCliConfig,
  resolveRepoConfig,
} from '../config/forge-config.js';

/**
 * Result of transforming a PlanVersion to ForgePlan.
 * Includes warnings about missing configurations.
 */
export interface TransformResult {
  /** The transformed ForgePlan */
  plan: ForgePlan;
  /** Warnings about missing role or scope mappings */
  warnings: TransformWarning[];
}

/**
 * Warning generated during plan transformation.
 */
export interface TransformWarning {
  type: 'missing_cli' | 'missing_repo' | 'missing_scope';
  step_id: string;
  message: string;
}

/**
 * Transforms a Planner step to a Forge step with resolved configuration.
 */
function transformStep(
  step: PlannerStep,
  config: ForgeConfig,
  warnings: TransformWarning[]
): ForgeStep {
  // Resolve CLI configuration from role
  const cliConfig = resolveCliConfig(config, step.owner_role);
  if (!cliConfig && step.owner_role) {
    warnings.push({
      type: 'missing_cli',
      step_id: step.step_id,
      message: `No CLI mapping found for role "${step.owner_role}", using default if available`,
    });
  }

  // Resolve repository configuration from scope
  const repoConfig = resolveRepoConfig(config, step.scope);
  if (!repoConfig && step.scope) {
    warnings.push({
      type: 'missing_repo',
      step_id: step.step_id,
      message: `No repository mapping found for scope "${step.scope}", using default if available`,
    });
  }

  // Warn if no scope is provided and no default repo
  if (!step.scope && !config.default_repo) {
    warnings.push({
      type: 'missing_scope',
      step_id: step.step_id,
      message: `Step has no scope and no default repository is configured`,
    });
  }

  // Transform acceptance criteria
  const acceptanceCriteria: AcceptanceCriterion[] | undefined = step.acceptance_criteria?.map(
    (ac) => ({
      id: ac.id,
      description: ac.description,
      type: ac.type,
    })
  );

  // Transform gate configuration
  const gate: GateConfig | undefined = step.gate
    ? {
        type: step.gate.type,
        approver_role: step.gate.approver_role,
      }
    : undefined;

  // Build the ForgeStep
  const forgeStep: ForgeStep = {
    step_id: step.step_id,
    title: step.title,
    dependencies: step.dependencies,
  };

  // Add optional fields only if present
  if (step.description) {
    forgeStep.description = step.description;
  }
  if (step.scope) {
    forgeStep.scope = step.scope;
  }
  if (step.owner_role) {
    forgeStep.owner_role = step.owner_role;
  }
  if (acceptanceCriteria && acceptanceCriteria.length > 0) {
    forgeStep.acceptance_criteria = acceptanceCriteria;
  }
  if (gate) {
    forgeStep.gate = gate;
  }
  if (step.sub_plan_id) {
    forgeStep.sub_plan_id = step.sub_plan_id;
  }
  if (step.specification) {
    forgeStep.specification = step.specification;
  }

  // Add resolved configuration from mappings
  if (repoConfig) {
    forgeStep.repo_url = repoConfig.repo_url;
  }
  if (cliConfig) {
    forgeStep.cli = cliConfig.cli;
    if (cliConfig.audit !== undefined) {
      forgeStep.audit = cliConfig.audit;
    }
  }

  // Resolve target_path: specification > repo config > monorepo convention
  if (step.specification && typeof step.specification === 'object') {
    const spec = step.specification as Record<string, unknown>;
    if (typeof spec.target_path === 'string') {
      forgeStep.target_path = spec.target_path;
    }
  }
  if (!forgeStep.target_path && repoConfig?.target_path) {
    forgeStep.target_path = repoConfig.target_path;
  }
  if (!forgeStep.target_path && step.scope) {
    // Monorepo convention fallback: packages/{scope}/src
    forgeStep.target_path = `packages/${step.scope}/src`;
  }

  return forgeStep;
}

/**
 * Transforms a PlanVersion from Planner to a ForgePlan for execution.
 *
 * This function:
 * 1. Maps plan metadata (id, version, summary)
 * 2. Transforms each step with resolved CLI and repository configurations
 * 3. Preserves dependencies, acceptance criteria, and gates
 * 4. Collects warnings about missing configurations
 *
 * @param planVersion - The PlanVersion from Planner API
 * @param config - The ForgeConfig with role and scope mappings
 * @returns TransformResult with the ForgePlan and any warnings
 */
export function transformToForgePlan(
  planVersion: PlanVersion,
  config: ForgeConfig
): TransformResult {
  const warnings: TransformWarning[] = [];

  // Transform all steps
  const steps = planVersion.steps.map((step) => transformStep(step, config, warnings));

  // Build the ForgePlan
  const forgePlan: ForgePlan = {
    plan_id: planVersion.plan_id,
    version: planVersion.version,
    summary: {
      goal: planVersion.summary.goal,
      context: planVersion.summary.context,
    },
    steps,
    context: planVersion.context,
    understanding: planVersion.understanding,
  };

  return {
    plan: forgePlan,
    warnings,
  };
}

/**
 * Checks if a transformed plan has any steps without resolved repository URLs.
 *
 * @param plan - The ForgePlan to check
 * @returns Array of step_ids that are missing repo_url
 */
export function getStepsWithoutRepo(plan: ForgePlan): string[] {
  return plan.steps.filter((step) => !step.repo_url).map((step) => step.step_id);
}

/**
 * Checks if a transformed plan has any steps without resolved CLI configuration.
 *
 * @param plan - The ForgePlan to check
 * @returns Array of step_ids that are missing cli
 */
export function getStepsWithoutCli(plan: ForgePlan): string[] {
  return plan.steps.filter((step) => !step.cli).map((step) => step.step_id);
}
