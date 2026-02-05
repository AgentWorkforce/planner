import { randomUUID } from 'node:crypto';
import type { Scenario } from '../scenarios/schema.js';
import type { RunResult, RunOptions } from './types.js';

/**
 * Mock executor that generates synthetic results without calling external services.
 * Useful for testing testbench itself and fast iteration.
 */
export class MockExecutor {
  async run(scenario: Scenario, _options?: RunOptions): Promise<RunResult> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    // Simulate some processing time (10-100ms)
    await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 90));

    const expected = scenario.expected;

    // Generate synthetic plan metrics
    const stepCount = expected?.step_count
      ? randomInRange(expected.step_count.min, expected.step_count.max)
      : randomInRange(2, 5);

    const complexityScore = this.difficultyToScore(scenario.difficulty);

    // Generate synthetic execution metrics
    const timeMinutes = expected?.time_minutes
      ? randomInRange(expected.time_minutes.min, expected.time_minutes.max)
      : randomInRange(1, 10);

    const tokensPerStep = 500 + Math.random() * 2000;
    const totalTokens = Math.round(stepCount * tokensPerStep);
    const costPerToken = 0.000003; // ~$3/million tokens
    const totalCost = totalTokens * costPerToken;

    // 80% success rate with random variation
    const success = Math.random() < 0.8;

    const completedAt = new Date().toISOString();
    const actualTimeSeconds = (Date.now() - startTime) / 1000 + timeMinutes * 60;

    return {
      scenario_id: scenario.id,
      run_id: runId,
      success,
      started_at: startedAt,
      completed_at: completedAt,
      plan_step_count: stepCount,
      estimated_complexity: complexityScore,
      estimated_time_minutes: timeMinutes,
      actual_time_seconds: actualTimeSeconds,
      actual_tokens: totalTokens,
      actual_cost_usd: Number(totalCost.toFixed(6)),
      verification_result: {
        passed: success,
        details: success ? 'Mock verification passed.' : 'Mock verification failed (simulated).',
      },
      mock: true,
    };
  }

  private difficultyToScore(difficulty: string): number {
    const base: Record<string, number> = {
      trivial: 8,
      simple: 25,
      moderate: 50,
      complex: 75,
    };
    const score = base[difficulty] ?? 30;
    // Add some variance (±20%)
    return Math.round(score * (0.8 + Math.random() * 0.4));
  }
}

function randomInRange(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}
