import { describe, it, expect } from 'vitest';
import { TaskQueue, type QueuedTask } from './task-queue.js';

describe('TaskQueue - Per-Scope Parallelism', () => {
  it('enforces per-scope limit when multiple scopes have ready tasks', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 4,
      max_concurrent_per_scope: 2,
      prefer_sequential_in_scope: false,
    });

    // Scenario: backend has 5 ready tasks, frontend has 3 ready tasks
    const readyTasks: QueuedTask[] = [
      { task_id: 'b1', step_id: 's1', scope: 'backend' },
      { task_id: 'b2', step_id: 's2', scope: 'backend' },
      { task_id: 'b3', step_id: 's3', scope: 'backend' },
      { task_id: 'b4', step_id: 's4', scope: 'backend' },
      { task_id: 'b5', step_id: 's5', scope: 'backend' },
      { task_id: 'f1', step_id: 's6', scope: 'frontend' },
      { task_id: 'f2', step_id: 's7', scope: 'frontend' },
      { task_id: 'f3', step_id: 's8', scope: 'frontend' },
    ];

    const selected = queue.getNextReadyTasks(readyTasks, []);

    // Should select 2 from backend and 2 from frontend (hits global max of 4)
    expect(selected.length).toBe(4);
    const backendSelected = selected.filter((t) => t.scope === 'backend');
    const frontendSelected = selected.filter((t) => t.scope === 'frontend');
    expect(backendSelected.length).toBe(2);
    expect(frontendSelected.length).toBe(2);
  });

  it('allows single scope to use up to global max when no contention', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 4,
      max_concurrent_per_scope: 2,
      prefer_sequential_in_scope: false,
    });

    // Only backend has ready tasks
    const readyTasks: QueuedTask[] = [
      { task_id: 'b1', step_id: 's1', scope: 'backend' },
      { task_id: 'b2', step_id: 's2', scope: 'backend' },
      { task_id: 'b3', step_id: 's3', scope: 'backend' },
      { task_id: 'b4', step_id: 's4', scope: 'backend' },
      { task_id: 'b5', step_id: 's5', scope: 'backend' },
    ];

    const selected = queue.getNextReadyTasks(readyTasks, []);

    // Backend can only select 2 (per-scope limit)
    expect(selected.length).toBe(2);
    expect(selected.every((t) => t.scope === 'backend')).toBe(true);
  });

  it('respects running tasks when calculating per-scope capacity', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 5,
      max_concurrent_per_scope: 2,
      prefer_sequential_in_scope: false,
    });

    const readyTasks: QueuedTask[] = [
      { task_id: 'b3', step_id: 's3', scope: 'backend' },
      { task_id: 'b4', step_id: 's4', scope: 'backend' },
      { task_id: 'f1', step_id: 's6', scope: 'frontend' },
      { task_id: 'f2', step_id: 's7', scope: 'frontend' },
    ];

    const running: QueuedTask[] = [
      { task_id: 'b1', step_id: 's1', scope: 'backend' },
      { task_id: 'b2', step_id: 's2', scope: 'backend' },
    ];

    const selected = queue.getNextReadyTasks(readyTasks, running);

    // Backend already running 2 (at per-scope limit), so only frontend can be selected
    expect(selected.length).toBe(2);
    expect(selected.every((t) => t.scope === 'frontend')).toBe(true);
  });

  it('handles tasks with undefined scope (default scope)', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 4,
      max_concurrent_per_scope: 2,
      prefer_sequential_in_scope: false,
    });

    const readyTasks: QueuedTask[] = [
      { task_id: 't1', step_id: 's1' }, // no scope
      { task_id: 't2', step_id: 's2' }, // no scope
      { task_id: 't3', step_id: 's3' }, // no scope
      { task_id: 'b1', step_id: 's4', scope: 'backend' },
      { task_id: 'b2', step_id: 's5', scope: 'backend' },
    ];

    const selected = queue.getNextReadyTasks(readyTasks, []);

    // Should select 2 from default scope and 2 from backend
    expect(selected.length).toBe(4);
    const defaultSelected = selected.filter((t) => !t.scope);
    const backendSelected = selected.filter((t) => t.scope === 'backend');
    expect(defaultSelected.length).toBe(2);
    expect(backendSelected.length).toBe(2);
  });

  it('respects global limit even with multiple scopes under per-scope limit', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 3,
      max_concurrent_per_scope: 2,
      prefer_sequential_in_scope: false,
    });

    const readyTasks: QueuedTask[] = [
      { task_id: 'b1', step_id: 's1', scope: 'backend' },
      { task_id: 'b2', step_id: 's2', scope: 'backend' },
      { task_id: 'f1', step_id: 's3', scope: 'frontend' },
      { task_id: 'f2', step_id: 's4', scope: 'frontend' },
    ];

    const selected = queue.getNextReadyTasks(readyTasks, []);

    // Global limit is 3, so can't select 2+2=4 tasks
    expect(selected.length).toBe(3);
  });

  it('respects sequential preference per scope', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 5,
      max_concurrent_per_scope: 3,
      prefer_sequential_in_scope: true, // Only 1 task per scope at a time
    });

    const readyTasks: QueuedTask[] = [
      { task_id: 'b1', step_id: 's1', scope: 'backend' },
      { task_id: 'b2', step_id: 's2', scope: 'backend' },
      { task_id: 'f1', step_id: 's3', scope: 'frontend' },
      { task_id: 'f2', step_id: 's4', scope: 'frontend' },
    ];

    const selected = queue.getNextReadyTasks(readyTasks, []);

    // Sequential mode: only 1 task per scope
    expect(selected.length).toBe(2);
    expect(selected.filter((t) => t.scope === 'backend').length).toBe(1);
    expect(selected.filter((t) => t.scope === 'frontend').length).toBe(1);
  });

  it('uses default per-scope limit of 2 when not configured', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 10,
      prefer_sequential_in_scope: false, // Disable sequential to test per-scope limit
      // No max_concurrent_per_scope specified — should default to 2
    });

    const readyTasks: QueuedTask[] = [
      { task_id: 'b1', step_id: 's1', scope: 'backend' },
      { task_id: 'b2', step_id: 's2', scope: 'backend' },
      { task_id: 'b3', step_id: 's3', scope: 'backend' },
      { task_id: 'b4', step_id: 's4', scope: 'backend' },
    ];

    const selected = queue.getNextReadyTasks(readyTasks, []);

    // Default per-scope limit is 2
    expect(selected.length).toBe(2);
  });

  it('prevents scope starvation with asymmetric ready task counts', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 6,
      max_concurrent_per_scope: 2,
      prefer_sequential_in_scope: false,
    });

    // Backend has 10 ready, frontend has 2 ready, infrastructure has 1 ready
    const readyTasks: QueuedTask[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        task_id: `b${i + 1}`,
        step_id: `bs${i + 1}`,
        scope: 'backend',
      })),
      { task_id: 'f1', step_id: 'fs1', scope: 'frontend' },
      { task_id: 'f2', step_id: 'fs2', scope: 'frontend' },
      { task_id: 'i1', step_id: 'is1', scope: 'infrastructure' },
    ];

    const selected = queue.getNextReadyTasks(readyTasks, []);

    // Should select 2 from each scope where available: 2 backend + 2 frontend + 1 infra = 5 total
    expect(selected.length).toBe(5);
    const backendSelected = selected.filter((t) => t.scope === 'backend');
    const frontendSelected = selected.filter((t) => t.scope === 'frontend');
    const infraSelected = selected.filter((t) => t.scope === 'infrastructure');
    expect(backendSelected.length).toBe(2);
    expect(frontendSelected.length).toBe(2);
    expect(infraSelected.length).toBe(1); // Only 1 ready
  });
});

describe('TaskQueue - updateConfig', () => {
  it('updates prefer_sequential_in_scope dynamically', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 5,
      max_concurrent_per_scope: 2,
      prefer_sequential_in_scope: true,
    });

    const readyTasks: QueuedTask[] = [
      { task_id: 'b1', step_id: 's1', scope: 'backend' },
      { task_id: 'b2', step_id: 's2', scope: 'backend' },
      { task_id: 'b3', step_id: 's3', scope: 'backend' },
    ];

    // Sequential mode: only 1 per scope
    let selected = queue.getNextReadyTasks(readyTasks, []);
    expect(selected.length).toBe(1);

    // Dynamically disable sequential mode
    queue.updateConfig({ prefer_sequential_in_scope: false });

    // Now should select up to per-scope limit
    selected = queue.getNextReadyTasks(readyTasks, []);
    expect(selected.length).toBe(2);
  });

  it('updates max_concurrent_per_scope dynamically', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 10,
      max_concurrent_per_scope: 2,
      prefer_sequential_in_scope: false,
    });

    const readyTasks: QueuedTask[] = [
      { task_id: 'b1', step_id: 's1', scope: 'backend' },
      { task_id: 'b2', step_id: 's2', scope: 'backend' },
      { task_id: 'b3', step_id: 's3', scope: 'backend' },
      { task_id: 'b4', step_id: 's4', scope: 'backend' },
    ];

    // Per-scope limit 2
    let selected = queue.getNextReadyTasks(readyTasks, []);
    expect(selected.length).toBe(2);

    // Increase per-scope limit to 3
    queue.updateConfig({ max_concurrent_per_scope: 3 });

    selected = queue.getNextReadyTasks(readyTasks, []);
    expect(selected.length).toBe(3);
  });

  it('partial updateConfig only changes specified fields', () => {
    const queue = new TaskQueue({
      max_concurrent_tasks: 5,
      max_concurrent_per_scope: 2,
      prefer_sequential_in_scope: true,
    });

    // Only update per-scope limit, leave sequential mode untouched
    queue.updateConfig({ max_concurrent_per_scope: 3 });

    const readyTasks: QueuedTask[] = [
      { task_id: 'b1', step_id: 's1', scope: 'backend' },
      { task_id: 'b2', step_id: 's2', scope: 'backend' },
      { task_id: 'b3', step_id: 's3', scope: 'backend' },
    ];

    // Sequential mode still active — only 1 per scope
    const selected = queue.getNextReadyTasks(readyTasks, []);
    expect(selected.length).toBe(1);
  });
});
