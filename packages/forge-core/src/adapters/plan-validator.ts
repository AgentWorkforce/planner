import type { ForgePlan, ForgeStep, Task } from '../domain/types.js';

/**
 * Validation error types.
 */
export type ValidationErrorType =
  | 'orphan_dependency'
  | 'cycle_detected'
  | 'missing_repo_url'
  | 'empty_steps'
  | 'duplicate_step_id'
  | 'self_dependency';

/**
 * Individual validation error with details.
 */
export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  step_id?: string;
  details?: Record<string, unknown>;
}

/**
 * Result of plan validation.
 */
export interface ValidationResult {
  /** Whether the plan is valid for execution */
  valid: boolean;
  /** List of validation errors (empty if valid) */
  errors: ValidationError[];
}

/**
 * Checks for orphan dependencies (references to non-existent step_ids).
 */
function checkOrphanDependencies(plan: ForgePlan): ValidationError[] {
  const errors: ValidationError[] = [];
  const stepIds = new Set(plan.steps.map((s) => s.step_id));

  for (const step of plan.steps) {
    for (const dep of step.dependencies) {
      if (!stepIds.has(dep)) {
        errors.push({
          type: 'orphan_dependency',
          message: `Step "${step.step_id}" depends on non-existent step "${dep}"`,
          step_id: step.step_id,
          details: { missing_dependency: dep },
        });
      }
    }
  }

  return errors;
}

/**
 * Checks for self-dependencies (step depending on itself).
 */
function checkSelfDependencies(plan: ForgePlan): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const step of plan.steps) {
    if (step.dependencies.includes(step.step_id)) {
      errors.push({
        type: 'self_dependency',
        message: `Step "${step.step_id}" depends on itself`,
        step_id: step.step_id,
      });
    }
  }

  return errors;
}

/**
 * Checks for cycles in the dependency graph using DFS.
 */
function checkCycles(plan: ForgePlan): ValidationError[] {
  const errors: ValidationError[] = [];

  // Build adjacency list (step -> steps that depend on it)
  const dependencyMap = new Map<string, string[]>();
  for (const step of plan.steps) {
    dependencyMap.set(step.step_id, step.dependencies);
  }

  // Track visited and recursion stack for cycle detection
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cyclePath: string[] = [];

  function hasCycle(stepId: string): boolean {
    if (recursionStack.has(stepId)) {
      // Found a cycle - build the cycle path
      const cycleStart = cyclePath.indexOf(stepId);
      const cycle = cyclePath.slice(cycleStart);
      cycle.push(stepId);
      errors.push({
        type: 'cycle_detected',
        message: `Cycle detected in dependency graph: ${cycle.join(' -> ')}`,
        step_id: stepId,
        details: { cycle },
      });
      return true;
    }

    if (visited.has(stepId)) {
      return false;
    }

    visited.add(stepId);
    recursionStack.add(stepId);
    cyclePath.push(stepId);

    const deps = dependencyMap.get(stepId) || [];
    for (const dep of deps) {
      if (hasCycle(dep)) {
        return true;
      }
    }

    recursionStack.delete(stepId);
    cyclePath.pop();
    return false;
  }

  // Check each step for cycles
  for (const step of plan.steps) {
    if (!visited.has(step.step_id)) {
      hasCycle(step.step_id);
    }
  }

  return errors;
}

/**
 * Checks that all steps have resolved repo_url.
 */
function checkRepoUrls(plan: ForgePlan): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const step of plan.steps) {
    if (!step.repo_url) {
      errors.push({
        type: 'missing_repo_url',
        message: `Step "${step.step_id}" has no resolved repository URL`,
        step_id: step.step_id,
      });
    }
  }

  return errors;
}

/**
 * Checks for duplicate step_ids.
 */
function checkDuplicateStepIds(plan: ForgePlan): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Map<string, number>();

  for (const step of plan.steps) {
    const count = (seen.get(step.step_id) || 0) + 1;
    seen.set(step.step_id, count);
  }

  for (const [stepId, count] of seen.entries()) {
    if (count > 1) {
      errors.push({
        type: 'duplicate_step_id',
        message: `Duplicate step_id "${stepId}" found ${count} times`,
        step_id: stepId,
        details: { count },
      });
    }
  }

  return errors;
}

/**
 * Validates a ForgePlan for execution readiness.
 *
 * Checks:
 * 1. Plan has at least one step
 * 2. No duplicate step_ids
 * 3. No orphan dependencies (references to non-existent steps)
 * 4. No self-dependencies
 * 5. No cycles in the dependency graph
 * 6. All steps have resolved repo_url
 *
 * @param plan - The ForgePlan to validate
 * @returns ValidationResult with valid flag and any errors
 */
export function validateForgePlan(plan: ForgePlan): ValidationResult {
  const errors: ValidationError[] = [];

  // Check for empty steps
  if (plan.steps.length === 0) {
    errors.push({
      type: 'empty_steps',
      message: 'Plan has no steps to execute',
    });
    return { valid: false, errors };
  }

  // Check for duplicate step_ids first (other checks depend on unique ids)
  errors.push(...checkDuplicateStepIds(plan));

  // If we have duplicates, skip other checks as they may give misleading results
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Run all other validations
  errors.push(...checkOrphanDependencies(plan));
  errors.push(...checkSelfDependencies(plan));
  errors.push(...checkCycles(plan));
  errors.push(...checkRepoUrls(plan));

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a ForgePlan but only for structural issues (dependencies).
 * Does not require repo_url to be resolved.
 * Useful for validating plans before configuration resolution.
 *
 * @param plan - The ForgePlan to validate
 * @returns ValidationResult with valid flag and any errors
 */
export function validatePlanStructure(plan: ForgePlan): ValidationResult {
  const errors: ValidationError[] = [];

  // Check for empty steps
  if (plan.steps.length === 0) {
    errors.push({
      type: 'empty_steps',
      message: 'Plan has no steps to execute',
    });
    return { valid: false, errors };
  }

  // Check for duplicate step_ids first
  errors.push(...checkDuplicateStepIds(plan));

  // If we have duplicates, skip other checks
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Only structural validations
  errors.push(...checkOrphanDependencies(plan));
  errors.push(...checkSelfDependencies(plan));
  errors.push(...checkCycles(plan));

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Gets the topological order of steps for execution.
 * Returns null if the plan has cycles.
 *
 * @param plan - The ForgePlan to sort
 * @returns Array of step_ids in topological order, or null if cycles exist
 */
export function getTopologicalOrder(plan: ForgePlan): string[] | null {
  // Kahn's algorithm for topological sort
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const step of plan.steps) {
    inDegree.set(step.step_id, step.dependencies.length);
    adjacency.set(step.step_id, []);
  }

  // Build reverse adjacency (step -> steps that depend on it)
  for (const step of plan.steps) {
    for (const dep of step.dependencies) {
      const dependents = adjacency.get(dep);
      if (dependents) {
        dependents.push(step.step_id);
      }
    }
  }

  // Start with nodes that have no dependencies
  const queue: string[] = [];
  for (const step of plan.steps) {
    if (step.dependencies.length === 0) {
      queue.push(step.step_id);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {
    const stepId = queue.shift()!;
    result.push(stepId);

    // Reduce in-degree of dependents
    const dependents = adjacency.get(stepId) || [];
    for (const dependent of dependents) {
      const newDegree = (inDegree.get(dependent) || 0) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // If we didn't process all steps, there's a cycle
  if (result.length !== plan.steps.length) {
    return null;
  }

  return result;
}

/**
 * Computes dependency tiers from a DAG of steps.
 * Tier 0 = no dependencies, Tier N = max(dependency tiers) + 1.
 * Returns null if the graph has cycles.
 */
export function computeDependencyTiers(steps: ForgeStep[]): Map<string, number> | null {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const tiers = new Map<string, number>();

  for (const step of steps) {
    inDegree.set(step.step_id, step.dependencies.length);
    adjacency.set(step.step_id, []);
  }

  for (const step of steps) {
    for (const dep of step.dependencies) {
      adjacency.get(dep)?.push(step.step_id);
    }
  }

  // Seed tier 0: nodes with no dependencies
  const queue: string[] = [];
  for (const step of steps) {
    if (step.dependencies.length === 0) {
      queue.push(step.step_id);
      tiers.set(step.step_id, 0);
    }
  }

  let processed = 0;

  while (queue.length > 0) {
    const stepId = queue.shift()!;
    processed++;
    const currentTier = tiers.get(stepId)!;

    for (const dependent of adjacency.get(stepId) || []) {
      // Dependent's tier = max of all its resolved dependency tiers + 1
      const existingTier = tiers.get(dependent) ?? 0;
      tiers.set(dependent, Math.max(existingTier, currentTier + 1));

      const newDegree = (inDegree.get(dependent) || 0) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  if (processed !== steps.length) {
    return null; // Cycle detected
  }

  return tiers;
}

/**
 * Groups tasks by (scope, tier) key.
 * Key format: "scope:tierN" (e.g., "api:tier0", "frontend:tier1").
 * Tasks without scope use "default" as the scope.
 */
export function groupByScopeTier(
  tasks: Task[],
  tierMap: Map<string, number>
): Map<string, Task[]> {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const scope = task.scope ?? 'default';
    const tier = tierMap.get(task.step_id) ?? 0;
    const key = `${scope}:tier${tier}`;

    const group = groups.get(key);
    if (group) {
      group.push(task);
    } else {
      groups.set(key, [task]);
    }
  }

  return groups;
}
