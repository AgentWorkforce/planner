/**
 * Plan-to-Workflow Compiler
 *
 * Transforms a PlanVersion (from the planner domain) into a RelayYamlConfig
 * suitable for dispatch via @agent-relay/sdk WorkflowRunner.
 *
 * This is a pure data transformation — no side effects, no storage calls.
 */

import type { RelayYamlConfig, AgentDefinition, WorkflowStep } from '@agent-relay/sdk/workflows';
import type { ModelSelector } from './model-selector.js';

// ============================================
// Minimal inline types
// ============================================
// These mirror the shapes from @plannr/planner domain types. Defined inline so
// this module stays decoupled from the planner package at import time. If/when
// @plannr/planner exports these cleanly, import them directly instead.

interface AcceptanceCriterion {
  id: string;
  description: string;
  type?: string;
}

interface Gate {
  type: 'human_approval';
  approver_role?: string;
}

/** Minimal step shape the compiler operates on. */
export interface PlanStep {
  step_id: string;
  title: string;
  description?: string;
  dependencies: string[];
  owner_role?: string;
  scope?: string;
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: Gate;
}

/** Minimal plan metadata shape the compiler needs. */
export interface PlanMeta {
  plan_id: string;
  version: number;
  summary?: { goal?: string; context?: string };
}

// ============================================
// ForgeConfig inline types
// ============================================
// Mirrors the types.ts definitions the other agent is creating. If types.ts
// exists, import from './types.js' instead and remove these.

interface StepOverride {
  step_id: string;
  skip?: boolean;
  model_override?: string;
}

interface ExecutionPolicy {
  max_concurrent_tasks?: number;
  max_timeout_ms?: number;
  retry_count?: number;
}

interface ForgeConfig {
  workspace_path?: string;
  step_overrides?: StepOverride[];
  execution_policy?: ExecutionPolicy;
}

// ============================================
// Compiler
// ============================================

/**
 * Compiles a PlanVersion into a RelayYamlConfig.
 *
 * @param plan - Plan metadata (id, version, summary goal)
 * @param steps - Steps from the plan version
 * @param config - Forge execution configuration (overrides, policy)
 * @param modelSelector - ModelSelector instance for per-step model routing
 * @returns A RelayYamlConfig ready for dispatch to WorkflowRunner
 */
export function compilePlan(
  plan: PlanMeta,
  steps: PlanStep[],
  config: ForgeConfig,
  modelSelector: ModelSelector
): RelayYamlConfig {
  // Build a set of skipped step_ids upfront for O(1) lookups
  const skippedIds = buildSkippedSet(config.step_overrides ?? []);

  // Only compile steps that are not skipped
  const activeSteps = steps.filter(s => !skippedIds.has(s.step_id));

  const agentDefinitions = buildAgentDefinitions(activeSteps, config, modelSelector);
  const workflowSteps = buildWorkflowSteps(activeSteps, config, skippedIds);

  const maxConcurrency = config.execution_policy?.max_concurrent_tasks ?? 5;

  return {
    version: '1.0',
    name: `plan-${plan.plan_id}-v${plan.version}`,
    description: plan.summary?.goal ?? 'Plan execution',
    swarm: {
      pattern: 'dag',
      maxConcurrency,
    },
    agents: agentDefinitions,
    workflows: [
      {
        name: 'execute',
        steps: workflowSteps,
        onError: 'fail',
      },
    ],
  };
}

// ============================================
// Agent Definition Builder
// ============================================

/**
 * Derives a deduplicated set of AgentDefinitions from the active steps.
 *
 * Each unique owner_role gets one agent entry. Steps without an owner_role
 * all share a single "default-worker" agent.
 */
function buildAgentDefinitions(
  activeSteps: PlanStep[],
  config: ForgeConfig,
  modelSelector: ModelSelector
): AgentDefinition[] {
  // Map from sanitized agent name → first step that contributed this role
  // (used to select the model for the role agent)
  const roleToStep = new Map<string, PlanStep>();

  for (const step of activeSteps) {
    const agentName = resolveAgentName(step.owner_role);
    if (!roleToStep.has(agentName)) {
      roleToStep.set(agentName, step);
    }
  }

  // If no active steps, return empty (no agents needed)
  if (roleToStep.size === 0) return [];

  const agents: AgentDefinition[] = [];

  for (const [agentName, representativeStep] of roleToStep) {
    const model = resolveModel(representativeStep, config, modelSelector);

    const agent: AgentDefinition = {
      name: agentName,
      cli: 'claude',
      role: representativeStep.owner_role,
      interactive: false,
      constraints: {
        model,
      },
    };

    if (config.workspace_path) {
      agent.cwd = config.workspace_path;
    }

    agents.push(agent);
  }

  return agents;
}

// ============================================
// Workflow Step Builder
// ============================================

/**
 * Maps plan steps to WorkflowSteps, filtering out skipped dependencies.
 */
function buildWorkflowSteps(
  activeSteps: PlanStep[],
  config: ForgeConfig,
  skippedIds: Set<string>
): WorkflowStep[] {
  const timeoutMs = config.execution_policy?.max_timeout_ms;
  const retries = config.execution_policy?.retry_count;

  return activeSteps.map(step => {
    const workflowStep: WorkflowStep = {
      name: step.step_id,
      agent: resolveAgentName(step.owner_role),
      task: composeTask(step),
      dependsOn: step.dependencies.filter(depId => !skippedIds.has(depId)),
    };

    if (timeoutMs != null) workflowStep.timeoutMs = timeoutMs;
    if (retries != null) workflowStep.retries = retries;

    const verification = buildVerification(step);
    if (verification) workflowStep.verification = verification;

    return workflowStep;
  });
}

// ============================================
// Helpers
// ============================================

/**
 * Builds the Set of step_ids to skip from StepOverride configuration.
 */
function buildSkippedSet(overrides: StepOverride[]): Set<string> {
  const skipped = new Set<string>();
  for (const override of overrides) {
    if (override.skip === true) {
      skipped.add(override.step_id);
    }
  }
  return skipped;
}

/**
 * Resolves the model to use for a step. Priority:
 * 1. Per-step model_override from ForgeConfig
 * 2. ModelSelector pattern matching
 */
function resolveModel(
  step: PlanStep,
  config: ForgeConfig,
  modelSelector: ModelSelector
): string {
  const override = config.step_overrides?.find(o => o.step_id === step.step_id);
  if (override?.model_override) return override.model_override;

  const { model } = modelSelector.selectModel({
    title: step.title,
    description: step.description,
    scope: step.scope,
    owner_role: step.owner_role,
  });

  return model;
}

/**
 * Composes the task string for an agent step from title, description, and
 * acceptance criteria.
 */
function composeTask(step: PlanStep): string {
  const parts: string[] = [`## ${step.title}`];

  if (step.description) {
    parts.push(step.description);
  }

  if (step.acceptance_criteria && step.acceptance_criteria.length > 0) {
    parts.push('\n### Acceptance Criteria');
    for (const criterion of step.acceptance_criteria) {
      parts.push(`- ${criterion.description}`);
    }
  }

  return parts.join('\n\n');
}

/**
 * Builds an output_contains VerificationCheck from acceptance criteria.
 * Uses the first criterion description as the verification value.
 * Returns null if no criteria exist.
 */
function buildVerification(
  step: PlanStep
): WorkflowStep['verification'] | null {
  if (!step.acceptance_criteria || step.acceptance_criteria.length === 0) {
    return null;
  }

  // Use the first criterion as the primary verification signal
  const primary = step.acceptance_criteria[0];
  return {
    type: 'output_contains',
    value: primary.description,
    description: `Verify: ${primary.description}`,
  };
}

/**
 * Converts an owner_role string to a valid relay agent name.
 *
 * Examples:
 *   "backend:Coder"  → "backend-coder"
 *   "frontend:React" → "frontend-react"
 *   undefined        → "default-worker"
 *
 * Rules: lowercase, replace non-alphanumeric runs with a hyphen, trim hyphens.
 */
export function sanitizeAgentName(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Returns the agent name for a step, falling back to "default-worker". */
function resolveAgentName(ownerRole: string | undefined): string {
  if (!ownerRole) return 'default-worker';
  const sanitized = sanitizeAgentName(ownerRole);
  return sanitized || 'default-worker';
}
