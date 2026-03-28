import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { MockExecutor } from '../runner/mock.js';
import { MetricsCollector } from '../metrics/collector.js';
import { LearningCurve } from '../metrics/learning.js';
import { ConsoleReporter } from '../reporting/console.js';
import { ResultsWriter } from '../reporting/writer.js';
import { ScenarioLoader } from '../scenarios/loader.js';
import { ScenarioSchema, type Scenario } from '../scenarios/schema.js';
import { WorkspaceManager } from '../workspace/manager.js';
import { loadConfigSync } from '../config/loader.js';
import { calculateComplexityAccuracy } from '../metrics/accuracy.js';
import type { RunResult } from '../runner/types.js';

// ============================================
// Scenario Loading
// ============================================

const SCENARIOS_DIR = resolve(import.meta.dirname, '../../scenarios');

describe('Scenario loading', () => {
  it('should load all starter scenarios', async () => {
    const loader = new ScenarioLoader(SCENARIOS_DIR);
    const scenarios = await loader.loadAll();
    expect(scenarios.length).toBeGreaterThanOrEqual(5);
  });

  it('should load scenario by id', async () => {
    const loader = new ScenarioLoader(SCENARIOS_DIR);
    const scenario = await loader.load('fizzbuzz');
    expect(scenario).toBeDefined();
    expect(scenario?.id).toBe('fizzbuzz');
  });

  it('should filter by difficulty', async () => {
    const loader = new ScenarioLoader(SCENARIOS_DIR);
    const trivial = await loader.loadByDifficulty('trivial');
    expect(trivial.length).toBeGreaterThanOrEqual(2);
    for (const s of trivial) {
      expect(s.difficulty).toBe('trivial');
    }
  });

  it('should validate all scenarios against schema', async () => {
    const loader = new ScenarioLoader(SCENARIOS_DIR);
    const scenarios = await loader.loadAll();
    for (const s of scenarios) {
      expect(() => ScenarioSchema.parse(s)).not.toThrow();
    }
  });
});

// ============================================
// Config
// ============================================

describe('Config', () => {
  it('should load default config', () => {
    const config = loadConfigSync();
    expect(config.planner_url).toBe('http://localhost:3001');
    expect(config.forge_url).toBe('http://localhost:3001/api/forge');
    expect(config.tuner_url).toBe('http://localhost:4002');
    expect(config.default_timeout_minutes).toBe(30);
  });

  it('should accept overrides', () => {
    const config = loadConfigSync({ default_timeout_minutes: 60 });
    expect(config.default_timeout_minutes).toBe(60);
  });
});

// ============================================
// WorkspaceManager
// ============================================

describe('WorkspaceManager', () => {
  it('should create and cleanup workspace', async () => {
    const mgr = new WorkspaceManager('/tmp/testbench-test');
    const ws = await mgr.create('test-scenario');
    expect(ws).toContain('test-scenario');
    expect(mgr.getActiveWorkspaces()).toContain(ws);

    await mgr.cleanup(ws);
    expect(mgr.getActiveWorkspaces()).not.toContain(ws);
  });

  it('should cleanup all workspaces', async () => {
    const mgr = new WorkspaceManager('/tmp/testbench-test-all');
    await mgr.create('scenario-a');
    await mgr.create('scenario-b');
    expect(mgr.getActiveWorkspaces().length).toBe(2);

    await mgr.cleanupAll();
    expect(mgr.getActiveWorkspaces().length).toBe(0);
  });
});

// ============================================
// Mock Execution
// ============================================

describe('Mock execution', () => {
  it('should run fizzbuzz scenario in mock mode', async () => {
    const loader = new ScenarioLoader(SCENARIOS_DIR);
    const scenario = await loader.load('fizzbuzz');
    expect(scenario).toBeDefined();

    const executor = new MockExecutor();
    const result = await executor.run(scenario!);

    expect(result.scenario_id).toBe('fizzbuzz');
    expect(result.mock).toBe(true);
    expect(result.actual_time_seconds).toBeGreaterThan(0);
    expect(result.plan_step_count).toBeDefined();
    expect(result.estimated_complexity).toBeDefined();
    expect(result.actual_tokens).toBeDefined();
    expect(result.actual_cost_usd).toBeDefined();
    expect(result.verification_result).toBeDefined();
  });

  it('should run all scenarios in mock mode', async () => {
    const loader = new ScenarioLoader(SCENARIOS_DIR);
    const scenarios = await loader.loadAll();
    const executor = new MockExecutor();
    const collector = new MetricsCollector();

    for (const scenario of scenarios) {
      const result = await executor.run(scenario);
      collector.add(result);
    }

    const aggregate = collector.getAggregate();
    expect(aggregate.total_runs).toBe(scenarios.length);
    expect(aggregate.total_runs).toBeGreaterThanOrEqual(5);
    expect(aggregate.mean_time_seconds).toBeGreaterThan(0);
  });
});

// ============================================
// Metrics
// ============================================

describe('MetricsCollector', () => {
  it('should aggregate results', () => {
    const collector = new MetricsCollector();

    const base: RunResult = {
      scenario_id: 'test',
      run_id: '1',
      success: true,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      actual_time_seconds: 10,
      actual_tokens: 1000,
      actual_cost_usd: 0.003,
      mock: true,
    };

    collector.add(base);
    collector.add({ ...base, run_id: '2', success: false, actual_time_seconds: 20 });
    collector.add({ ...base, run_id: '3', actual_time_seconds: 15 });

    const agg = collector.getAggregate();
    expect(agg.total_runs).toBe(3);
    expect(agg.success_count).toBe(2);
    expect(agg.failure_count).toBe(1);
    expect(agg.success_rate).toBeCloseTo(2 / 3);
    expect(agg.mean_time_seconds).toBeCloseTo(15);
  });

  it('should handle empty results', () => {
    const collector = new MetricsCollector();
    const agg = collector.getAggregate();
    expect(agg.total_runs).toBe(0);
    expect(agg.success_rate).toBe(0);
    expect(agg.complexity_accuracy).toBeNull();
  });
});

// ============================================
// Complexity Accuracy
// ============================================

describe('Complexity accuracy', () => {
  it('should return null for less than 2 data points', () => {
    expect(calculateComplexityAccuracy([])).toBeNull();

    const single: RunResult = {
      scenario_id: 'test',
      run_id: '1',
      success: true,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      actual_time_seconds: 10,
      estimated_complexity: 50,
      mock: true,
    };
    expect(calculateComplexityAccuracy([single])).toBeNull();
  });

  it('should calculate positive correlation', () => {
    const results: RunResult[] = [
      makeResult(10, 60),
      makeResult(20, 120),
      makeResult(30, 180),
      makeResult(40, 240),
    ];

    const accuracy = calculateComplexityAccuracy(results);
    expect(accuracy).not.toBeNull();
    expect(accuracy!).toBeCloseTo(1.0, 1); // Perfect positive correlation
  });

  it('should handle no correlation', () => {
    const results: RunResult[] = [
      makeResult(10, 100),
      makeResult(20, 50),
      makeResult(30, 200),
      makeResult(40, 25),
    ];

    const accuracy = calculateComplexityAccuracy(results);
    expect(accuracy).not.toBeNull();
    // No specific value expected, just that it's computable
    expect(Math.abs(accuracy!)).toBeLessThanOrEqual(1);
  });
});

// ============================================
// Learning Curve
// ============================================

describe('LearningCurve', () => {
  it('should track iterations', () => {
    const curve = new LearningCurve();
    curve.addIteration(1, { total_runs: 5, success_count: 3, failure_count: 2, success_rate: 0.6, mean_time_seconds: 100, p95_time_seconds: 150, mean_cost_usd: 0.01, total_cost_usd: 0.05, total_tokens: 5000, complexity_accuracy: 0.5 });
    curve.addIteration(2, { total_runs: 5, success_count: 4, failure_count: 1, success_rate: 0.8, mean_time_seconds: 90, p95_time_seconds: 130, mean_cost_usd: 0.009, total_cost_usd: 0.045, total_tokens: 4500, complexity_accuracy: 0.7 });

    const points = curve.getCurve();
    expect(points.length).toBe(2);
    expect(points[0].iteration).toBe(1);
    expect(points[1].iteration).toBe(2);
  });

  it('should calculate improvement', () => {
    const curve = new LearningCurve();
    curve.addIteration(1, { total_runs: 5, success_count: 3, failure_count: 2, success_rate: 0.6, mean_time_seconds: 100, p95_time_seconds: 150, mean_cost_usd: 0.01, total_cost_usd: 0.05, total_tokens: 5000, complexity_accuracy: 0.5 });
    curve.addIteration(2, { total_runs: 5, success_count: 4, failure_count: 1, success_rate: 0.8, mean_time_seconds: 90, p95_time_seconds: 130, mean_cost_usd: 0.009, total_cost_usd: 0.045, total_tokens: 4500, complexity_accuracy: 0.7 });

    const imp = curve.getImprovement();
    expect(imp).not.toBeNull();
    expect(imp!.success_rate_delta).toBeCloseTo(0.2);
    expect(imp!.accuracy_delta).toBeCloseTo(0.2);
    expect(imp!.time_delta).toBeCloseTo(-10);
  });

  it('should return null improvement for < 2 points', () => {
    const curve = new LearningCurve();
    expect(curve.getImprovement()).toBeNull();
  });
});

// ============================================
// Results Writer
// ============================================

describe('ResultsWriter', () => {
  it('should write results to JSON file', async () => {
    const writer = new ResultsWriter();
    const results: RunResult[] = [
      makeResult(10, 60, { scenario_id: 'fizzbuzz', success: true }),
    ];
    const aggregate = new MetricsCollector();
    aggregate.add(results[0]);

    const path = `/tmp/testbench-test-results/test-${Date.now()}.json`;
    await writer.write(results, aggregate.getAggregate(), path);

    const content = readFileSync(path, 'utf-8');
    const data = JSON.parse(content);
    expect(data.metadata.total_runs).toBe(1);
    expect(data.results.length).toBe(1);
    expect(data.aggregate.total_runs).toBe(1);
  });
});

// ============================================
// Helpers
// ============================================

function makeResult(complexity: number, timeSeconds: number, overrides?: Partial<RunResult>): RunResult {
  return {
    scenario_id: 'test',
    run_id: crypto.randomUUID(),
    success: true,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    actual_time_seconds: timeSeconds,
    estimated_complexity: complexity,
    mock: true,
    ...overrides,
  };
}
