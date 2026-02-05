import type { RunResult } from '../runner/types.js';
import { calculateComplexityAccuracy } from './accuracy.js';

export interface AggregateMetrics {
  total_runs: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  mean_time_seconds: number;
  p95_time_seconds: number;
  mean_cost_usd: number;
  total_cost_usd: number;
  total_tokens: number;
  complexity_accuracy: number | null;
}

export class MetricsCollector {
  private results: RunResult[] = [];

  add(result: RunResult): void {
    this.results.push(result);
  }

  addAll(results: RunResult[]): void {
    this.results.push(...results);
  }

  getResults(): RunResult[] {
    return [...this.results];
  }

  getAggregate(): AggregateMetrics {
    const n = this.results.length;

    if (n === 0) {
      return {
        total_runs: 0,
        success_count: 0,
        failure_count: 0,
        success_rate: 0,
        mean_time_seconds: 0,
        p95_time_seconds: 0,
        mean_cost_usd: 0,
        total_cost_usd: 0,
        total_tokens: 0,
        complexity_accuracy: null,
      };
    }

    const successCount = this.results.filter((r) => r.success).length;
    const times = this.results.map((r) => r.actual_time_seconds).sort((a, b) => a - b);
    const costs = this.results.map((r) => r.actual_cost_usd ?? 0);
    const tokens = this.results.map((r) => r.actual_tokens ?? 0);

    const meanTime = times.reduce((a, b) => a + b, 0) / n;
    const p95Index = Math.min(Math.ceil(n * 0.95) - 1, n - 1);
    const p95Time = times[p95Index];

    const totalCost = costs.reduce((a, b) => a + b, 0);
    const totalTokens = tokens.reduce((a, b) => a + b, 0);

    return {
      total_runs: n,
      success_count: successCount,
      failure_count: n - successCount,
      success_rate: successCount / n,
      mean_time_seconds: meanTime,
      p95_time_seconds: p95Time,
      mean_cost_usd: totalCost / n,
      total_cost_usd: totalCost,
      total_tokens: totalTokens,
      complexity_accuracy: calculateComplexityAccuracy(this.results),
    };
  }

  clear(): void {
    this.results = [];
  }
}
