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
import type { StepBaton, CompiledPhase, TopicSummary } from './types.js';

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
  /** Shell commands to run before/after the agent step ($0 LLM cost) */
  hooks?: { before_run?: string; after_run?: string };
  /** Complexity score 0-100 from planner's DOT Framework estimator */
  complexity_score?: number;
}

/** Plan-embedded execution config defaults (authored during planning). */
export interface PlanExecutionConfig {
  max_concurrent?: number;
  timeout_minutes?: number;
  retry_count?: number;
  step_overrides?: Record<string, { model?: string; skip?: boolean }>;
}

/** Minimal plan metadata shape the compiler needs. */
export interface PlanMeta {
  plan_id: string;
  version: number;
  summary?: { goal?: string; context?: string };
  execution_config?: PlanExecutionConfig;
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
  /** Phase boundaries detected in the compiled step sequence */
  phases: CompiledPhase[];
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
  // Merge plan-embedded execution defaults into config (explicit config wins)
  const mergedConfig = applyPlanDefaults(config, plan.execution_config);

  // Build a set of skipped step_ids upfront for O(1) lookups
  const skippedIds = buildSkippedSet(mergedConfig.step_overrides ?? []);

  // Only compile steps that are not skipped
  const activeSteps = steps.filter(s => !skippedIds.has(s.step_id));

  const phases = detectPhases(activeSteps);

  // Build step → phase lookup for baton injection
  const stepPhaseMap = new Map<string, { phaseId: string; isTerminal: boolean }>();
  for (const phase of phases) {
    const lastStepId = phase.step_ids[phase.step_ids.length - 1];
    for (const stepId of phase.step_ids) {
      stepPhaseMap.set(stepId, {
        phaseId: phase.phase_id,
        // Only inject handoff instructions for terminal steps of phases that produce batons
        isTerminal: stepId === lastStepId && phase.produces_baton,
      });
    }
  }

  const agentDefinitions = buildAgentDefinitions(activeSteps, mergedConfig, modelSelector);
  const workflowSteps = buildWorkflowSteps(activeSteps, mergedConfig, skippedIds, stepPhaseMap);

  // Adaptive concurrency: if the user didn't explicitly set a value, derive from
  // plan complexity profile. Research (arXiv:2512.08296) shows that complex/
  // interdependent plans suffer from high parallelism due to error amplification,
  // while simple parallelizable plans benefit from more concurrency.
  const maxConcurrency = mergedConfig.execution_policy?.max_concurrent_tasks
    ?? inferMaxConcurrency(activeSteps);

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

  return { config: relayYamlConfig, phases, stepCriteria, stepRetryHints, stepMergeStrategies };
}

// ============================================
// Phase Detection
// ============================================

/**
 * Detect phase boundaries in a sequence of plan steps.
 *
 * Heuristics (applied in order, first match triggers boundary):
 * 1. Scope change: consecutive steps with different scope values
 * 2. Gate step: any step with gate.type === 'human_approval' ends a phase
 * 3. Role change: consecutive steps with different owner_role
 * 4. Step count cap: every maxStepsPerPhase steps (default 5)
 *
 * Steps are processed in input order (assumed DAG-topological from planner).
 */
export function detectPhases(
  steps: PlanStep[],
  maxStepsPerPhase = 5,
): CompiledPhase[] {
  if (steps.length === 0) return [];

  const phases: CompiledPhase[] = [];
  let currentStepIds: string[] = [];
  let currentScope: string | undefined;
  let currentRole: string | undefined;
  let phaseCounter = 1;

  const flushPhase = (boundaryReason?: CompiledPhase['boundary_reason']) => {
    if (currentStepIds.length === 0) return;

    const phaseId = `phase-${phaseCounter}`;
    const prevPhaseId = phaseCounter > 1 ? `phase-${phaseCounter - 1}` : undefined;

    phases.push({
      phase_id: phaseId,
      step_ids: [...currentStepIds],
      boundary_reason: boundaryReason,
      requires_baton_from: prevPhaseId,
      produces_baton: true,
    });

    phaseCounter++;
    currentStepIds = [];
  };

  for (const step of steps) {
    const stepScope = step.scope;
    const stepRole = step.owner_role;

    // Check boundary conditions only after at least one step is in the current phase
    if (currentStepIds.length > 0) {
      if (stepScope !== currentScope && (currentScope !== undefined || stepScope !== undefined)) {
        // 1. Scope change (including transitions to/from undefined)
        flushPhase('scope_change');
      } else if (stepRole !== currentRole && (currentRole !== undefined || stepRole !== undefined)) {
        // 3. Role change (including transitions to/from undefined)
        flushPhase('role_change');
      } else if (currentStepIds.length >= maxStepsPerPhase) {
        // 4. Step count cap
        flushPhase('step_count_cap');
      }
    }

    currentStepIds.push(step.step_id);
    currentScope = stepScope;
    currentRole = stepRole;

    // 2. Gate ends a phase (after adding the gated step to the current phase)
    if (step.gate?.type === 'human_approval') {
      flushPhase('gate');
    }
  }

  // Flush any remaining steps as the final phase
  flushPhase();

  // Last phase doesn't need to produce a baton — no subsequent phase will read it
  if (phases.length > 0) {
    phases[phases.length - 1].produces_baton = false;
  }

  return phases;
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
  skippedIds: Set<string>,
  stepPhaseMap: Map<string, { phaseId: string; isTerminal: boolean }>,
): WorkflowStep[] {
  const timeoutMs = config.execution_policy?.max_timeout_ms;
  const retries = config.execution_policy?.retry_count;

  const contextSteps = activeSteps.length > 15 ? activeSteps : undefined;

  // Collect step IDs that have :post hooks so downstream deps can be re-wired
  const hasPostHook = new Set<string>();
  for (const step of activeSteps) {
    if (step.hooks?.after_run) {
      hasPostHook.add(step.step_id);
    }
  }

  const result: WorkflowStep[] = [];

  for (const step of activeSteps) {
    const baseDeps = step.dependencies.filter(depId => !skippedIds.has(depId));

    // Re-wire: if a dependency has a :post hook, depend on that instead
    const resolvedDeps = baseDeps.map(depId =>
      hasPostHook.has(depId) ? `${depId}:post` : depId,
    );

    // before_run hook → deterministic pre-step
    if (step.hooks?.before_run) {
      result.push({
        name: `${step.step_id}:pre`,
        type: 'deterministic',
        command: step.hooks.before_run,
        dependsOn: resolvedDeps,
      } as WorkflowStep);
    }

    // Main agent step
    const mainDeps = step.hooks?.before_run
      ? [`${step.step_id}:pre`]
      : resolvedDeps;

    const phaseEntry = stepPhaseMap.get(step.step_id);
    const phaseInfo = phaseEntry
      ? { isPhaseTerminal: phaseEntry.isTerminal, phaseId: phaseEntry.phaseId }
      : undefined;

    const workflowStep: WorkflowStep = {
      name: step.step_id,
      agent: resolveAgentName(step.owner_role),
      task: composeTask(step, contextSteps, phaseInfo),
      dependsOn: mainDeps,
    };

    if (timeoutMs != null) workflowStep.timeoutMs = timeoutMs;
    if (retries != null) workflowStep.retries = retries;

    const verification = buildVerification(step);
    if (verification) workflowStep.verification = verification;

    result.push(workflowStep);

    // after_run hook → deterministic post-step
    if (step.hooks?.after_run) {
      result.push({
        name: `${step.step_id}:post`,
        type: 'deterministic',
        command: step.hooks.after_run,
        dependsOn: [step.step_id],
      } as WorkflowStep);
    }
  }

  return result;
}

// ============================================
// Helpers
// ============================================

/**
 * Merges plan-embedded execution defaults into the explicit ForgeConfig.
 * Explicit config values always take priority over plan defaults.
 */
function applyPlanDefaults(
  config: ForgeConfig,
  planDefaults?: PlanExecutionConfig,
): ForgeConfig {
  if (!planDefaults) return config;

  const policy: ExecutionPolicy = { ...config.execution_policy };
  if (policy.max_concurrent_tasks == null && planDefaults.max_concurrent != null) {
    policy.max_concurrent_tasks = planDefaults.max_concurrent;
  }
  if (policy.max_timeout_ms == null && planDefaults.timeout_minutes != null) {
    policy.max_timeout_ms = planDefaults.timeout_minutes * 60_000;
  }
  if (policy.retry_count == null && planDefaults.retry_count != null) {
    policy.retry_count = planDefaults.retry_count;
  }

  // Merge plan step overrides as fallback (explicit overrides win)
  let overrides = config.step_overrides ?? [];
  if (planDefaults.step_overrides) {
    const explicitIds = new Set(overrides.map(o => o.step_id));
    for (const [stepId, planOverride] of Object.entries(planDefaults.step_overrides)) {
      if (!explicitIds.has(stepId)) {
        overrides = [...overrides, {
          step_id: stepId,
          skip: planOverride.skip,
          model_override: planOverride.model,
        }];
      }
    }
  }

  return {
    ...config,
    execution_policy: policy,
    step_overrides: overrides,
  };
}

/**
 * Infers max concurrency from the plan's complexity profile.
 *
 * Research basis (arXiv:2512.08296 — "Scaling Agent Systems"):
 * - High-complexity plans amplify errors under high parallelism (17x vs 4x)
 * - Tightly-coupled plans (high dep density) degrade with more concurrency
 * - Simple, independent plans benefit from aggressive parallelism
 *
 * Strategy:
 * - avgComplexity >= 60: cap at 2 (complex, error-prone — serialize more)
 * - avgComplexity >= 40: cap at 3 (moderate — balanced)
 * - depDensity >= 0.5: cap at 2 (tightly coupled — sequential reasoning penalty)
 * - else: 5 (simple/independent — maximize throughput)
 */
function inferMaxConcurrency(steps: PlanStep[]): number {
  if (steps.length <= 1) return 1;

  // Average complexity score (default 30 if no scores available)
  const scores = steps
    .map(s => s.complexity_score)
    .filter((s): s is number => s != null);
  const avgComplexity = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 30;

  // Dependency density: ratio of total dep edges to possible edges
  const totalDeps = steps.reduce((sum, s) => sum + s.dependencies.length, 0);
  const maxPossibleDeps = steps.length * (steps.length - 1) / 2;
  const depDensity = maxPossibleDeps > 0 ? totalDeps / maxPossibleDeps : 0;

  // Tightly coupled plans should serialize more
  if (depDensity >= 0.5) return 2;

  // Complex plans: fewer concurrent agents to reduce error amplification
  if (avgComplexity >= 60) return 2;
  if (avgComplexity >= 40) return 3;

  return 5;
}

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
    complexity_score: step.complexity_score,
  });

  return model;
}

/**
 * Composes the task string for an agent step from title, description, and
 * acceptance criteria. For large plans (>15 steps), appends a Plan Context
 * section using a pyramid summarization strategy: direct dependencies with
 * acceptance criteria, then other steps grouped by scope.
 *
 * When `phaseInfo.isPhaseTerminal` is true, baton writing instructions are
 * injected before the retry awareness section so the last step in a phase
 * produces a structured handoff for the next phase.
 */
function composeTask(
  step: PlanStep,
  allSteps?: PlanStep[],
  phaseInfo?: { isPhaseTerminal: boolean; phaseId: string },
): string {
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

  // Baton handoff: injected only for the terminal step of a phase
  if (phaseInfo?.isPhaseTerminal) {
    parts.push(
      `### Handoff\n\n` +
      `You are the last step in this execution phase. When you complete your work, ` +
      `write a handoff file to \`.forge/batons/${phaseInfo.phaseId}.json\` containing:\n\n` +
      `\`\`\`json\n` +
      `{\n` +
      `  "completed_steps": [{"step_id": "...", "title": "...", "summary": "1-sentence summary"}],\n` +
      `  "artifacts": [{"path": "file/path", "description": "what this file does"}],\n` +
      `  "gotchas": ["things the next agent needs to know"],\n` +
      `  "decisions": [{"what": "choice made", "why": "reasoning"}],\n` +
      `  "state": "current state of the codebase relevant to next steps"\n` +
      `}\n` +
      `\`\`\`\n\n` +
      `Keep it concise — under 40 lines. The next agent starts fresh; this is all they'll know.`,
    );
  }

  // Retry-awareness: tell agent to check for prior failure context on disk
  parts.push(
    `### Retry Awareness\n\n` +
    `Before starting work, check if \`.forge/retry-context/${step.step_id}.md\` exists. ` +
    `If it does, a previous attempt at this task failed. Read the file to understand ` +
    `what went wrong and adjust your approach accordingly.`,
  );

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

// ============================================
// Baton context formatting
// ============================================

/**
 * Format a previous phase's baton as context for the current phase's first step.
 *
 * Returns a markdown block summarising what the prior phase accomplished,
 * which files it produced, any gotchas, and key decisions made. Returns an
 * empty string if the baton carries no meaningful content.
 */
export function formatBatonContext(baton: StepBaton): string {
  // Check if baton has any meaningful content before building the section
  const hasContent = baton.completed_steps.length > 0
    || baton.artifacts.length > 0
    || baton.gotchas.length > 0
    || baton.decisions.length > 0
    || baton.state;

  if (!hasContent) return '';

  const parts: string[] = ['### Previous Phase Handoff\n'];

  if (baton.completed_steps.length > 0) {
    parts.push('**Completed:**');
    for (const step of baton.completed_steps) {
      parts.push(`- ${step.title}: ${step.summary}`);
    }
    parts.push('');
  }

  if (baton.artifacts.length > 0) {
    parts.push('**Files created/modified:**');
    for (const artifact of baton.artifacts) {
      parts.push(`- \`${artifact.path}\` — ${artifact.description}`);
    }
    parts.push('');
  }

  if (baton.gotchas.length > 0) {
    parts.push('**Watch out for:**');
    for (const gotcha of baton.gotchas) {
      parts.push(`- ${gotcha}`);
    }
    parts.push('');
  }

  if (baton.decisions.length > 0) {
    parts.push('**Decisions made:**');
    for (const decision of baton.decisions) {
      parts.push(`- ${decision.what} — ${decision.why}`);
    }
    parts.push('');
  }

  if (baton.state) {
    parts.push(`**Current state:** ${baton.state}`);
  }

  return parts.join('\n');
}

// ============================================
// Topic injection (knowledge flywheel)
// ============================================

/** Max tokens of topic content to inject per step. */
const TOPIC_INJECTION_BUDGET = 1000;
const TOPIC_CHARS_PER_TOKEN = 3.5;
const TOPIC_CHAR_BUDGET = TOPIC_INJECTION_BUDGET * TOPIC_CHARS_PER_TOKEN;

/**
 * Format topic summaries as a markdown section for injection into a step task.
 * Respects the token budget — truncates if necessary.
 */
function formatTopicContext(topics: TopicSummary[]): string {
  if (topics.length === 0) return '';

  const parts: string[] = [
    '### Prior Knowledge\n',
    'Relevant insights from previous work:\n',
  ];

  let charCount = parts.join('').length;

  for (const topic of topics) {
    const section = `**${topic.slug}**\n${topic.content}\n`;
    if (charCount + section.length > TOPIC_CHAR_BUDGET) break;
    parts.push(section);
    charCount += section.length;
  }

  // If we only have the header and no topics fit, return empty
  if (parts.length <= 2) return '';

  return parts.join('\n');
}

/**
 * Enrich compiled workflow step tasks with relevant topic file content.
 * Called after compilePlan() with topic data fetched asynchronously.
 *
 * @param config - The compiled RelayYamlConfig to enrich
 * @param topicsByStep - Map of step name → topic summaries to inject
 * @returns A new config with enriched task descriptions
 */
export function enrichWithTopics(
  config: RelayYamlConfig,
  topicsByStep: Map<string, TopicSummary[]>,
): RelayYamlConfig {
  if (topicsByStep.size === 0) return config;
  if (!config.workflows) return config;

  // Deep clone workflows to avoid mutation
  const enrichedWorkflows = config.workflows.map(workflow => ({
    ...workflow,
    steps: workflow.steps.map(step => {
      const topics = topicsByStep.get(step.name);
      if (!topics || topics.length === 0 || !step.task) return step;

      const topicSection = formatTopicContext(topics);
      if (!topicSection) return step;

      return {
        ...step,
        task: step.task + '\n\n' + topicSection,
      };
    }),
  }));

  return {
    ...config,
    workflows: enrichedWorkflows,
  };
}

/**
 * Extract search keywords from a step for topic matching.
 * Used by the server layer to query TopicProvider before calling enrichWithTopics.
 */
export function extractStepKeywords(step: PlanStep): string[] {
  const text = [step.title, step.description ?? '', step.scope ?? ''].join(' ');

  // Extract meaningful words (3+ chars, skip common stop words)
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'will', 'should',
    'have', 'been', 'into', 'also', 'each', 'when', 'then', 'than', 'them',
    'some', 'other', 'more', 'about', 'like', 'just', 'over', 'such', 'make',
    'can', 'add', 'use', 'set', 'new', 'get', 'all', 'may', 'any',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i); // deduplicate
}
