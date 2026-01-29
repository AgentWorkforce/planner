import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTopologicalSort } from './useTopologicalSort';
import type { Step } from '@/types';

function createStep(id: string, deps: string[] = [], scope?: string): Step {
  return {
    step_id: id,
    title: `Step ${id}`,
    description: `Description for ${id}`,
    dependencies: deps,
    scope,
    acceptance_criteria: [],
  };
}

describe('useTopologicalSort', () => {
  it('returns empty map for empty steps array', () => {
    const { result } = renderHook(() => useTopologicalSort([]));
    expect(result.current.size).toBe(0);
  });

  it('assigns column 0 to steps with no dependencies', () => {
    const steps = [createStep('a'), createStep('b'), createStep('c')];
    const { result } = renderHook(() => useTopologicalSort(steps));

    expect(result.current.get('a')).toBe(0);
    expect(result.current.get('b')).toBe(0);
    expect(result.current.get('c')).toBe(0);
  });

  it('assigns increasing columns based on dependency depth', () => {
    const steps = [
      createStep('a'),
      createStep('b', ['a']),
      createStep('c', ['b']),
    ];
    const { result } = renderHook(() => useTopologicalSort(steps));

    expect(result.current.get('a')).toBe(0);
    expect(result.current.get('b')).toBe(1);
    expect(result.current.get('c')).toBe(2);
  });

  it('handles multiple dependencies taking the max depth', () => {
    const steps = [
      createStep('a'),
      createStep('b'),
      createStep('c', ['a']),
      createStep('d', ['a', 'b', 'c']), // depends on a (depth 0), b (depth 0), c (depth 1)
    ];
    const { result } = renderHook(() => useTopologicalSort(steps));

    expect(result.current.get('a')).toBe(0);
    expect(result.current.get('b')).toBe(0);
    expect(result.current.get('c')).toBe(1);
    expect(result.current.get('d')).toBe(2); // max(0, 0, 1) + 1 = 2
  });

  it('handles diamond dependency pattern', () => {
    // Diamond: a -> b, a -> c, b -> d, c -> d
    const steps = [
      createStep('a'),
      createStep('b', ['a']),
      createStep('c', ['a']),
      createStep('d', ['b', 'c']),
    ];
    const { result } = renderHook(() => useTopologicalSort(steps));

    expect(result.current.get('a')).toBe(0);
    expect(result.current.get('b')).toBe(1);
    expect(result.current.get('c')).toBe(1);
    expect(result.current.get('d')).toBe(2);
  });

  it('handles cross-scope dependencies correctly', () => {
    const steps = [
      createStep('a', [], 'backend'),
      createStep('b', ['a'], 'frontend'),
      createStep('c', ['b'], 'frontend'),
    ];
    const { result } = renderHook(() => useTopologicalSort(steps));

    expect(result.current.get('a')).toBe(0);
    expect(result.current.get('b')).toBe(1);
    expect(result.current.get('c')).toBe(2);
  });

  it('ignores dependencies on steps not in the set', () => {
    const steps = [
      createStep('a', ['external-step']), // external-step not in steps array
      createStep('b', ['a']),
    ];
    const { result } = renderHook(() => useTopologicalSort(steps));

    expect(result.current.get('a')).toBe(0); // external dep ignored
    expect(result.current.get('b')).toBe(1);
  });

  it('handles cycles gracefully without infinite loop', () => {
    // Cycle: a -> b -> c -> a
    const steps = [
      createStep('a', ['c']),
      createStep('b', ['a']),
      createStep('c', ['b']),
    ];

    // Should not throw or hang
    const { result } = renderHook(() => useTopologicalSort(steps));

    // All steps should have a column assigned
    expect(result.current.has('a')).toBe(true);
    expect(result.current.has('b')).toBe(true);
    expect(result.current.has('c')).toBe(true);
  });

  it('memoizes result for same steps reference', () => {
    const steps = [createStep('a'), createStep('b', ['a'])];
    const { result, rerender } = renderHook(
      ({ steps }) => useTopologicalSort(steps),
      { initialProps: { steps } }
    );

    const firstResult = result.current;
    rerender({ steps });
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult); // Same reference
  });

  it('recomputes when steps change', () => {
    const steps1 = [createStep('a')];
    const steps2 = [createStep('a'), createStep('b', ['a'])];

    const { result, rerender } = renderHook(
      ({ steps }) => useTopologicalSort(steps),
      { initialProps: { steps: steps1 } }
    );

    expect(result.current.size).toBe(1);

    rerender({ steps: steps2 });

    expect(result.current.size).toBe(2);
    expect(result.current.get('b')).toBe(1);
  });
});
