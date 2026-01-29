import { useMemo } from 'react';
import type { Step } from '@/types';

/**
 * Hook that returns Map<stepId, column_index> for left-to-right positioning in swimlane view.
 * Steps with no dependencies come first (column 0), then their dependents, etc.
 */
export function useTopologicalSort(steps: Step[]): Map<string, number> {
  return useMemo(() => {
    const columnMap = new Map<string, number>();

    if (steps.length === 0) {
      return columnMap;
    }

    // Build dependency graph
    const dependencyMap = new Map<string, string[]>();
    const stepIds = new Set<string>();

    for (const step of steps) {
      stepIds.add(step.step_id);
      dependencyMap.set(step.step_id, step.dependencies || []);
    }

    // Compute depth for each step (longest path from root)
    const depths = new Map<string, number>();
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function getDepth(stepId: string): number {
      if (depths.has(stepId)) {
        return depths.get(stepId)!;
      }

      // Handle cycles gracefully
      if (visiting.has(stepId)) {
        return 0;
      }

      // Step doesn't exist in our set (external dependency)
      if (!stepIds.has(stepId)) {
        return -1;
      }

      visiting.add(stepId);

      const deps = dependencyMap.get(stepId) || [];
      let maxDepDepth = -1;

      for (const depId of deps) {
        if (stepIds.has(depId)) {
          const depDepth = getDepth(depId);
          maxDepDepth = Math.max(maxDepDepth, depDepth);
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);

      const depth = maxDepDepth + 1;
      depths.set(stepId, depth);
      return depth;
    }

    // Calculate depth for all steps
    for (const step of steps) {
      getDepth(step.step_id);
    }

    // Convert depths to column indices
    for (const step of steps) {
      const depth = depths.get(step.step_id) ?? 0;
      columnMap.set(step.step_id, depth);
    }

    return columnMap;
  }, [steps]);
}
