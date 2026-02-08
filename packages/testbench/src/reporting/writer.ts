import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RunResult } from '../runner/types.js';
import type { AggregateMetrics } from '../metrics/collector.js';
import type { LearningPoint } from '../metrics/learning.js';

export interface ResultsFile {
  metadata: {
    timestamp: string;
    testbench_version: string;
    total_scenarios: number;
    total_runs: number;
  };
  results: RunResult[];
  aggregate: AggregateMetrics;
  learning_curve?: LearningPoint[];
}

export class ResultsWriter {
  async write(
    results: RunResult[],
    aggregate: AggregateMetrics,
    outputPath: string,
    learningCurve?: LearningPoint[]
  ): Promise<string> {
    const dir = dirname(outputPath);
    await mkdir(dir, { recursive: true });

    const data: ResultsFile = {
      metadata: {
        timestamp: new Date().toISOString(),
        testbench_version: '0.1.0',
        total_scenarios: new Set(results.map((r) => r.scenario_id)).size,
        total_runs: results.length,
      },
      results,
      aggregate,
      learning_curve: learningCurve,
    };

    const json = JSON.stringify(data, null, 2);
    await writeFile(outputPath, json, 'utf-8');
    return outputPath;
  }

  static defaultFilename(resultsDir: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return join(resultsDir, `results-${timestamp}.json`);
  }
}
