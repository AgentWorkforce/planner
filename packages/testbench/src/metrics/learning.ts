import type { AggregateMetrics } from './collector.js';

export interface LearningPoint {
  iteration: number;
  success_rate: number;
  complexity_accuracy: number | null;
  mean_time_seconds: number;
  total_cost_usd: number;
}

export class LearningCurve {
  private points: LearningPoint[] = [];

  addIteration(iteration: number, metrics: AggregateMetrics): void {
    this.points.push({
      iteration,
      success_rate: metrics.success_rate,
      complexity_accuracy: metrics.complexity_accuracy,
      mean_time_seconds: metrics.mean_time_seconds,
      total_cost_usd: metrics.total_cost_usd,
    });
  }

  getCurve(): LearningPoint[] {
    return [...this.points];
  }

  getImprovement(): {
    success_rate_delta: number;
    accuracy_delta: number | null;
    time_delta: number;
  } | null {
    if (this.points.length < 2) return null;

    const first = this.points[0];
    const last = this.points[this.points.length - 1];

    return {
      success_rate_delta: last.success_rate - first.success_rate,
      accuracy_delta:
        first.complexity_accuracy !== null && last.complexity_accuracy !== null
          ? last.complexity_accuracy - first.complexity_accuracy
          : null,
      time_delta: last.mean_time_seconds - first.mean_time_seconds,
    };
  }
}
