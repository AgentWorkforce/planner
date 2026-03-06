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

export interface AcceptanceCriterion {
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
  /** Static recovery guidance for retry attempts */
  retry_hints?: string[];
  /** How git changes from this step should be merged back */
  merge_strategy?: string;
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
// CompilationResult
// ============================================

export interface CompilationResult {
  config: RelayYamlConfig;
  /** Acceptance criteria per step_id, for post-execution scoring */
  stepCriteria: Map<string, AcceptanceCriterion[]>;
  /** Static recovery hints per step_id, for retry context */
  stepRetryHints: Map<string, string[]>;
  /** Merge strategy per step_id, for orchestration metadata */
  stepMergeStrategies: Map<string, string>;
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
 * @returns A CompilationResult containing the RelayYamlConfig and a map of step acceptance criteria
 */
export function compilePlan(
  plan: PlanMeta,
  steps: PlanStep[],
  config: ForgeConfig,
  modelSelector: ModelSelector
): CompilationResult {
  // Build a set of skipped step_ids upfront for O(1) lookups
  const skippedIds = buildSkippedSet(config.step_overrides ?? []);

  // Only compile steps that are not skipped
  const activeSteps = steps.filter(s => !skippedIds.has(s.step_id));

  const agentDefinitions = buildAgentDefinitions(activeSteps, config, modelSelector);
  const workflowSteps = buildWorkflowSteps(activeSteps, config, skippedIds);

  const maxConcurrency = config.execution_policy?.max_concurrent_tasks ?? 5;

  const relayYamlConfig: RelayYamlConfig = {
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

  // Build criteria map for post-execution satisfaction scoring
  const stepCriteria = new Map<string, AcceptanceCriterion[]>();
  // Build retry hints map for retry context enrichment
  const stepRetryHints = new Map<string, string[]>();
  // Build merge strategy map for orchestration metadata
  const stepMergeStrategies = new Map<string, string>();

  for (const step of activeSteps) {
    if (step.acceptance_criteria && step.acceptance_criteria.length > 0) {
      stepCriteria.set(step.step_id, step.acceptance_criteria);
    }
    if (step.retry_hints && step.retry_hints.length > 0) {
      stepRetryHints.set(step.step_id, step.retry_hints);
    }
    if (step.merge_strategy) {
      stepMergeStrategies.set(step.step_id, step.merge_strategy);
    }
  }

  return { config: relayYamlConfig, stepCriteria, stepRetryHints, stepMergeStrategies };
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

  const contextSteps = activeSteps.length > 15 ? activeSteps : undefined;

  return activeSteps.map(step => {
    const workflowStep: WorkflowStep = {
      name: step.step_id,
      agent: resolveAgentName(step.owner_role),
      task: composeTask(step, contextSteps),
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
 * acceptance criteria. For large plans (>15 steps), appends a Plan Context
 * section using a pyramid summarization strategy: direct dependencies with
 * acceptance criteria, then other steps grouped by scope.
 */
function composeTask(step: PlanStep, allSteps?: PlanStep[]): string {
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

  if (step.retry_hints && step.retry_hints.length > 0) {
    parts.push('### Recovery Guidance (if retrying)');
    for (const hint of step.retry_hints) {
      parts.push(`- ${hint}`);
    }
  }

  if (allSteps !== undefined && allSteps.length > 15) {
    parts.push(composePlanContext(step, allSteps));
  }

  return parts.join('\n\n');
}

/**
 * Builds the Plan Context section for a step in a large plan.
 *
 * Pyramid strategy:
 * 1. Direct dependencies: title + first acceptance criterion
 * 2. All other steps (not current, not deps): grouped by scope, titles only
 *
 * Enforces an 8000 character budget. If exceeded, drops the "Other steps"
 * section and keeps only dependencies.
 */
function composePlanContext(step: PlanStep, allSteps: PlanStep[]): string {
  const depIdSet = new Set(step.dependencies);

  // Direct dependencies (steps this step depends on)
  const depSteps = allSteps.filter(s => depIdSet.has(s.step_id));

  // All other steps excluding the current step and its dependencies
  const otherSteps = allSteps.filter(
    s => s.step_id !== step.step_id && !depIdSet.has(s.step_id)
  );

  const headerLine = `### Plan Context\n\nThis step is part of a larger plan with ${allSteps.length} total steps.`;

  // Build the dependencies block
  let depsBlock = '';
  if (depSteps.length > 0) {
    const depLines = depSteps.map(dep => {
      const firstCriterion = dep.acceptance_criteria?.[0]?.description;
      return firstCriterion
        ? `- ${dep.title}: ${firstCriterion}`
        : `- ${dep.title}`;
    });
    depsBlock = `\n\n**Direct dependencies** (steps this depends on):\n${depLines.join('\n')}`;
  }

  // Build the "other steps by scope" block
  let otherBlock = '';
  if (otherSteps.length > 0) {
    const byScope = new Map<string, string[]>();
    for (const s of otherSteps) {
      const scope = s.scope ?? 'general';
      const existing = byScope.get(scope);
      if (existing) {
        existing.push(s.title);
      } else {
        byScope.set(scope, [s.title]);
      }
    }

    const scopeLines: string[] = ['\n\n**Other steps by scope:**'];
    for (const [scope, titles] of byScope) {
      scopeLines.push(`${scope}:`);
      for (const title of titles) {
        scopeLines.push(`  - ${title}`);
      }
    }
    otherBlock = scopeLines.join('\n');
  }

  const CONTEXT_BUDGET = 8000;
  const fullContext = headerLine + depsBlock + otherBlock;

  if (fullContext.length <= CONTEXT_BUDGET) {
    return fullContext;
  }

  // Exceeds budget: drop other steps, keep only dependencies
  return headerLine + depsBlock;
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
