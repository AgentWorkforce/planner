import { describe, it, expect } from 'vitest';
import { MASTER_RUN_PARALLELISM, DEFAULT_EXECUTION_POLICY } from './types.js';

describe('MASTER_RUN_PARALLELISM', () => {
  it('disables sequential-in-scope for master runs', () => {
    expect(MASTER_RUN_PARALLELISM.prefer_sequential_in_scope).toBe(false);
  });

  it('allows more concurrent tasks per scope than default', () => {
    expect(MASTER_RUN_PARALLELISM.max_concurrent_per_scope).toBe(3);
    expect(DEFAULT_EXECUTION_POLICY.parallelism.max_concurrent_per_scope).toBe(2);
    expect(MASTER_RUN_PARALLELISM.max_concurrent_per_scope!).toBeGreaterThan(
      DEFAULT_EXECUTION_POLICY.parallelism.max_concurrent_per_scope
    );
  });

  it('does not override max_concurrent_tasks (leaves it to global default)', () => {
    expect(MASTER_RUN_PARALLELISM.max_concurrent_tasks).toBeUndefined();
  });
});
