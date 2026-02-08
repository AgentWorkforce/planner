import type { RunResult } from '../runner/types.js';
import type { AggregateMetrics } from '../metrics/collector.js';
import type { LearningPoint } from '../metrics/learning.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

export class ConsoleReporter {
  reportRun(result: RunResult): void {
    const icon = result.success ? `${GREEN}\u2713${RESET}` : `${RED}\u2717${RESET}`;
    const time = `${result.actual_time_seconds.toFixed(1)}s`;
    const cost = result.actual_cost_usd !== undefined
      ? `$${result.actual_cost_usd.toFixed(4)}`
      : '';
    const mock = result.mock ? `${DIM}[mock]${RESET}` : '';

    const parts = [icon, result.scenario_id, `(${time}`, cost ? `, ${cost})` : ')', mock];
    console.log(parts.filter(Boolean).join(' '));

    if (!result.success && result.error) {
      console.log(`  ${RED}Error: ${result.error}${RESET}`);
    }

    if (!result.success && result.verification_result && !result.verification_result.passed) {
      console.log(`  ${RED}Verification: ${result.verification_result.details.slice(0, 200)}${RESET}`);
    }

    if (result.ideation_metrics) {
      const im = result.ideation_metrics;
      console.log(`  ${DIM}Ideation: ${im.ideation_strategy}, ${im.specialist_count} specialist(s), ${im.curated_block_count}/${im.block_count} blocks curated, ${im.ideation_time_ms}ms${RESET}`);
    }
  }

  reportAggregate(metrics: AggregateMetrics): void {
    console.log('');
    console.log('─'.repeat(50));
    console.log('Summary');
    console.log('─'.repeat(50));

    const rateColor = metrics.success_rate >= 0.8 ? GREEN : metrics.success_rate >= 0.5 ? YELLOW : RED;

    console.log(`  Runs:     ${metrics.total_runs}`);
    console.log(`  Passed:   ${GREEN}${metrics.success_count}${RESET}`);
    console.log(`  Failed:   ${metrics.failure_count > 0 ? RED : ''}${metrics.failure_count}${RESET}`);
    console.log(`  Rate:     ${rateColor}${(metrics.success_rate * 100).toFixed(1)}%${RESET}`);
    console.log(`  Time:     mean ${metrics.mean_time_seconds.toFixed(1)}s, p95 ${metrics.p95_time_seconds.toFixed(1)}s`);
    console.log(`  Cost:     $${metrics.total_cost_usd.toFixed(4)} total, $${metrics.mean_cost_usd.toFixed(4)} avg`);
    console.log(`  Tokens:   ${metrics.total_tokens.toLocaleString()}`);

    if (metrics.complexity_accuracy !== null) {
      const acc = metrics.complexity_accuracy;
      const accColor = acc > 0.5 ? GREEN : acc > 0 ? YELLOW : RED;
      console.log(`  Complexity Correlation: ${accColor}${acc.toFixed(3)}${RESET} (r ∈ [-1,1], higher is better)`);
    } else {
      console.log(`  Complexity Correlation: N/A (insufficient data)`);
    }
  }

  reportLearningCurve(curve: LearningPoint[]): void {
    if (curve.length === 0) return;

    console.log('');
    console.log('Learning Curve');
    console.log('─'.repeat(50));
    console.log(`  ${'Iter'.padEnd(6)} ${'Rate'.padEnd(8)} ${'Accuracy'.padEnd(10)} ${'Time'.padEnd(10)}`);

    for (const point of curve) {
      const rate = `${(point.success_rate * 100).toFixed(0)}%`;
      const acc = point.complexity_accuracy !== null ? point.complexity_accuracy.toFixed(3) : 'n/a';
      const time = `${point.mean_time_seconds.toFixed(1)}s`;
      console.log(`  ${String(point.iteration).padEnd(6)} ${rate.padEnd(8)} ${acc.padEnd(10)} ${time.padEnd(10)}`);
    }
  }
}
