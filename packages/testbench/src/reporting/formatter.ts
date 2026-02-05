import { readFile } from 'node:fs/promises';
import type { ResultsFile } from './writer.js';
import { ConsoleReporter } from './console.js';

export class ReportFormatter {
  private readonly reporter = new ConsoleReporter();

  async format(resultsPath: string): Promise<void> {
    const content = await readFile(resultsPath, 'utf-8');
    const data = JSON.parse(content) as ResultsFile;

    console.log(`\nTestbench Results: ${resultsPath}`);
    console.log(`Generated: ${data.metadata.timestamp}`);
    console.log(`Scenarios: ${data.metadata.total_scenarios}, Runs: ${data.metadata.total_runs}`);
    console.log('');

    // Per-run breakdown
    for (const result of data.results) {
      this.reporter.reportRun(result);
    }

    // Aggregate
    this.reporter.reportAggregate(data.aggregate);

    // Learning curve (if present)
    if (data.learning_curve && data.learning_curve.length > 0) {
      this.reporter.reportLearningCurve(data.learning_curve);
    }
  }
}
