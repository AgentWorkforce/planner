import type { TreeStep } from '@/components/tree/ProjectTree';

/**
 * Topological sort for tree steps within a scope using Kahn's algorithm.
 * Steps with no dependencies come first.
 * Handles cycles gracefully by breaking them and preserving original order for cyclic nodes.
 *
 * @param steps - Array of steps to sort
 * @returns Topologically sorted array of steps
 */
export function topologicalSort(steps: TreeStep[]): TreeStep[] {
  if (steps.length === 0) return [];

  // Build step ID to step map for quick lookup
  const stepMap = new Map<string, TreeStep>();
  steps.forEach((step) => stepMap.set(step.step_id, step));

  // Calculate in-degree for each step (how many dependencies point to it)
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>(); // adjacency list: step_id -> [dependent_step_ids]

  // Initialize
  steps.forEach((step) => {
    inDegree.set(step.step_id, 0);
    adjList.set(step.step_id, []);
  });

  // Build graph
  steps.forEach((step) => {
    step.dependencies.forEach((depId) => {
      // Only count dependencies that exist in this step set (same scope)
      if (stepMap.has(depId)) {
        inDegree.set(step.step_id, (inDegree.get(step.step_id) || 0) + 1);
        const deps = adjList.get(depId) || [];
        deps.push(step.step_id);
        adjList.set(depId, deps);
      }
    });
  });

  // Kahn's algorithm: start with nodes that have no incoming edges
  const queue: string[] = [];
  inDegree.forEach((degree, stepId) => {
    if (degree === 0) {
      queue.push(stepId);
    }
  });

  const sorted: TreeStep[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentStep = stepMap.get(currentId);

    if (currentStep && !visited.has(currentId)) {
      sorted.push(currentStep);
      visited.add(currentId);

      // Reduce in-degree for all dependent steps
      const dependents = adjList.get(currentId) || [];
      dependents.forEach((depId) => {
        const newDegree = (inDegree.get(depId) || 0) - 1;
        inDegree.set(depId, newDegree);

        if (newDegree === 0) {
          queue.push(depId);
        }
      });
    }
  }

  // Handle cycles: add remaining steps in their original order
  if (sorted.length < steps.length) {
    steps.forEach((step) => {
      if (!visited.has(step.step_id)) {
        sorted.push(step);
      }
    });
  }

  return sorted;
}

/**
 * Apply status overlay to topologically sorted steps.
 * Priority order (top to bottom):
 * 1. Running or blocked steps (active work)
 * 2. Failed steps (need attention)
 * 3. Pending steps (ready to work)
 * 4. Completed steps (done)
 *
 * Within each priority group, preserve topological order.
 *
 * @param steps - Topologically sorted steps
 * @returns Steps reordered with status overlay applied
 */
export function orderStepsWithStatusOverlay(steps: TreeStep[]): TreeStep[] {
  const statusPriority: Record<string, number> = {
    running: 1,
    blocked: 1,
    failed: 2,
    pending: 3,
    done: 4,
  };

  // Partition by status priority while preserving order within each group
  const groups: Record<number, TreeStep[]> = {
    1: [], // running/blocked
    2: [], // failed
    3: [], // pending
    4: [], // done
  };

  steps.forEach((step) => {
    const status = step.execution_status || 'pending';
    const priority = statusPriority[status] || 3; // default to pending priority
    (groups[priority] ??= []).push(step);
  });

  // Concatenate groups in priority order
  return [...(groups[1] ?? []), ...(groups[2] ?? []), ...(groups[3] ?? []), ...(groups[4] ?? [])];
}

/**
 * Determine if a scope is "active" (has running or blocked steps),
 * "completed" (all steps done), or "pending" (everything else).
 *
 * @param steps - Steps in the scope
 * @returns Scope status
 */
function getScopeStatus(steps: TreeStep[]): 'active' | 'completed' | 'pending' {
  if (steps.length === 0) return 'pending';

  const hasActive = steps.some(
    (s) => s.execution_status === 'running' || s.execution_status === 'blocked'
  );

  if (hasActive) return 'active';

  const allDone = steps.every((s) => s.execution_status === 'done');

  if (allDone) return 'completed';

  return 'pending';
}

/**
 * Order scopes by activity level.
 * Priority order:
 * 1. Active scopes (have running/blocked steps)
 * 2. Pending scopes (have pending/failed steps)
 * 3. Completed scopes (all steps done)
 *
 * Within each priority group, sort alphabetically.
 *
 * @param scopedSteps - Record mapping scope IDs to their steps
 * @returns Ordered array of scope IDs
 */
export function orderScopes(scopedSteps: Record<string, TreeStep[]>): string[] {
  const scopeEntries = Object.entries(scopedSteps);

  // Partition scopes by status
  const activeScopes: string[] = [];
  const pendingScopes: string[] = [];
  const completedScopes: string[] = [];

  scopeEntries.forEach(([scopeId, steps]) => {
    const status = getScopeStatus(steps);

    if (status === 'active') {
      activeScopes.push(scopeId);
    } else if (status === 'completed') {
      completedScopes.push(scopeId);
    } else {
      pendingScopes.push(scopeId);
    }
  });

  // Sort alphabetically within each group
  activeScopes.sort();
  pendingScopes.sort();
  completedScopes.sort();

  return [...activeScopes, ...pendingScopes, ...completedScopes];
}

/**
 * Check if a scope should start collapsed based on completion status.
 *
 * @param steps - Steps in the scope
 * @returns True if scope should start collapsed (all steps done)
 */
export function shouldAutoCollapse(steps: TreeStep[]): boolean {
  if (steps.length === 0) return false;
  return steps.every((s) => s.execution_status === 'done');
}
