import { z } from 'zod';
import { AcceptanceCriterionSchema, type AcceptanceCriterion } from './criterion.js';
import { GateSchema, type Gate } from './gate.js';
import { ComplexityEstimateSchema, type ComplexityEstimate } from './complexity.js';
import { LanguageTierSchema, type LanguageTier } from './language-tier.js';
import { TaskContractSchema, type TaskContract } from './contract.js';

/**
 * Step is the atomic unit of work within a plan.
 * - step_id: unique identifier within the plan
 * - title: human-readable title
 * - scope: optional context (repo/team/domain)
 * - description: detailed description of work
 * - dependencies: step_ids this step depends on (forms DAG)
 * - owner_role: role responsible (e.g., 'backend:Coder'), not specific agent
 * - acceptance_criteria: conditions for completion
 * - gate: optional human approval checkpoint
 * - sub_plan_id: reference to another PlanVersion for nested complexity
 * - complexity_estimate: DOT Framework - computed complexity for the step (optional)
 * - language_tier: DOT Framework - detected programming language tier (optional)
 * - contract: DOT Framework - input/output contract for the step (optional)
 */
export const StepSchema = z.object({
  step_id: z.string().min(1, 'Step id is required'),
  title: z.string().min(1, 'Step title is required'),
  scope: z.string().optional(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  owner_role: z.string().optional(),
  acceptance_criteria: z.array(AcceptanceCriterionSchema).optional(),
  gate: GateSchema.optional(),
  sub_plan_id: z.string().uuid().optional(),
  /** DOT Framework: Computed complexity estimate for the step */
  complexity_estimate: ComplexityEstimateSchema.optional(),
  /** DOT Framework: Detected programming language tier */
  language_tier: LanguageTierSchema.optional(),
  /** DOT Framework: Input/output contract for the step */
  contract: TaskContractSchema.optional(),
  /** Implementation specification — target files, patterns, architecture notes */
  specification: z.record(z.string(), z.unknown()).optional(),
});

export type Step = z.infer<typeof StepSchema>;

export interface CreateStepOptions {
  scope?: string;
  description?: string;
  owner_role?: string;
  dependencies?: string[];
  acceptance_criteria?: AcceptanceCriterion[];
  gate?: Gate;
  sub_plan_id?: string;
  /** DOT Framework: Pre-computed complexity estimate */
  complexity_estimate?: ComplexityEstimate;
  /** DOT Framework: Detected language tier */
  language_tier?: LanguageTier;
  /** DOT Framework: Task contract */
  contract?: TaskContract;
}

/**
 * Creates a new Step with generated UUID
 */
export function createStep(title: string, options: CreateStepOptions = {}): Step {
  const step: Step = {
    step_id: crypto.randomUUID(),
    title,
    dependencies: options.dependencies ?? [],
  };

  if (options.scope !== undefined) step.scope = options.scope;
  if (options.description !== undefined) step.description = options.description;
  if (options.owner_role !== undefined) step.owner_role = options.owner_role;
  if (options.acceptance_criteria !== undefined) {
    step.acceptance_criteria = options.acceptance_criteria;
  }
  if (options.gate !== undefined) step.gate = options.gate;
  if (options.sub_plan_id !== undefined) step.sub_plan_id = options.sub_plan_id;
  // DOT Framework fields
  if (options.complexity_estimate !== undefined) {
    step.complexity_estimate = options.complexity_estimate;
  }
  if (options.language_tier !== undefined) step.language_tier = options.language_tier;
  if (options.contract !== undefined) step.contract = options.contract;

  return StepSchema.parse(step);
}

/**
 * Validates that steps form a valid DAG (directed acyclic graph).
 * Checks for:
 * - Cycles in dependencies
 * - References to non-existent step_ids
 */
export function validateStepDag(steps: Step[]): boolean {
  if (steps.length === 0) return true;

  // Build a set of valid step_ids
  const stepIds = new Set(steps.map((s) => s.step_id));

  // Check all dependencies reference existing steps
  for (const step of steps) {
    for (const dep of step.dependencies) {
      if (!stepIds.has(dep)) {
        return false; // Reference to non-existent step
      }
    }
  }

  // Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (stepId: string): boolean => {
    if (recursionStack.has(stepId)) return true;
    if (visited.has(stepId)) return false;

    visited.add(stepId);
    recursionStack.add(stepId);

    const step = steps.find((s) => s.step_id === stepId);
    if (step) {
      for (const dep of step.dependencies) {
        if (hasCycle(dep)) return true;
      }
    }

    recursionStack.delete(stepId);
    return false;
  };

  for (const step of steps) {
    if (hasCycle(step.step_id)) return false;
  }

  return true;
}
