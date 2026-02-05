#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import { loadConfig } from './config/loader.js';
import { ScenarioLoader } from './scenarios/loader.js';
import { ScenarioRunner } from './runner/runner.js';
import { MockExecutor } from './runner/mock.js';
import { MetricsCollector } from './metrics/collector.js';
import { LearningCurve } from './metrics/learning.js';
import { ConsoleReporter } from './reporting/console.js';
import { ResultsWriter } from './reporting/writer.js';
import { ReportFormatter } from './reporting/formatter.js';
import type { Scenario } from './scenarios/schema.js';
import type { RunResult } from './runner/types.js';

const program = new Command();

program
  .name('testbench')
  .description('End-to-end pipeline testbench for Planner, Forge, and Tuner')
  .version('0.1.0')
  .option('--config <path>', 'Config file path')
  .option('--verbose', 'Enable verbose output');

// ============================================
// run command
// ============================================

program
  .command('run')
  .argument('[scenario]', 'Scenario ID to run')
  .option('--category <difficulty>', 'Run all scenarios of this difficulty')
  .option('--all', 'Run all scenarios')
  .option('--mock', 'Use mock execution (no external services)')
  .option('--output <file>', 'Save results to file')
  .option('--timeout <minutes>', 'Execution timeout per scenario', '30')
  .description('Run scenarios')
  .action(async (scenarioId: string | undefined, opts: Record<string, string | boolean | undefined>) => {
    const config = await loadConfig();
    const scenariosDir = resolve(process.cwd(), 'scenarios');
    const loader = new ScenarioLoader(scenariosDir);
    const reporter = new ConsoleReporter();
    const collector = new MetricsCollector();

    // Determine which scenarios to run
    let scenarios: Scenario[];
    if (opts.all) {
      scenarios = await loader.loadAll();
    } else if (opts.category) {
      scenarios = await loader.loadByDifficulty(opts.category as 'trivial' | 'simple' | 'moderate' | 'complex');
    } else if (scenarioId) {
      const scenario = await loader.load(scenarioId);
      if (!scenario) {
        console.error(`Scenario '${scenarioId}' not found.`);
        process.exit(1);
      }
      scenarios = [scenario];
    } else {
      console.error('Specify a scenario ID, --category, or --all');
      process.exit(1);
    }

    console.log(`Running ${scenarios.length} scenario(s)${opts.mock ? ' [mock mode]' : ''}...\n`);

    const mock = Boolean(opts.mock);
    const mockExecutor = new MockExecutor();
    const runner = new ScenarioRunner(config);
    const timeout = Number(opts.timeout) || 30;

    for (const scenario of scenarios) {
      let result: RunResult;
      if (mock) {
        result = await mockExecutor.run(scenario, { timeout_minutes: timeout });
      } else {
        result = await runner.run(scenario, { timeout_minutes: timeout });
      }
      collector.add(result);
      reporter.reportRun(result);
    }

    const aggregate = collector.getAggregate();
    reporter.reportAggregate(aggregate);

    if (opts.output) {
      const writer = new ResultsWriter();
      const path = await writer.write(collector.getResults(), aggregate, String(opts.output));
      console.log(`\nResults saved to: ${path}`);
    }

    process.exit(aggregate.failure_count > 0 ? 1 : 0);
  });

// ============================================
// train command
// ============================================

program
  .command('train')
  .option('--iterations <n>', 'Number of training iterations', '10')
  .option('--scenarios <ids>', 'Comma-separated scenario IDs')
  .option('--category <difficulty>', 'Filter by difficulty')
  .option('--mock', 'Use mock execution')
  .option('--output <file>', 'Save results to file')
  .option('--timeout <minutes>', 'Execution timeout per scenario', '30')
  .description('Run training iterations')
  .action(async (opts: Record<string, string | boolean | undefined>) => {
    const config = await loadConfig();
    const scenariosDir = resolve(process.cwd(), 'scenarios');
    const loader = new ScenarioLoader(scenariosDir);
    const reporter = new ConsoleReporter();
    const curve = new LearningCurve();

    const iterations = Number(opts.iterations) || 10;
    const mock = Boolean(opts.mock);
    const timeout = Number(opts.timeout) || 30;

    // Determine scenarios
    let scenarios: Scenario[];
    if (opts.scenarios) {
      const ids = String(opts.scenarios).split(',');
      scenarios = [];
      for (const id of ids) {
        const s = await loader.load(id.trim());
        if (s) scenarios.push(s);
      }
    } else if (opts.category) {
      scenarios = await loader.loadByDifficulty(opts.category as 'trivial' | 'simple' | 'moderate' | 'complex');
    } else {
      scenarios = await loader.loadAll();
    }

    if (scenarios.length === 0) {
      console.error('No scenarios found.');
      process.exit(1);
    }

    console.log(`Training: ${scenarios.length} scenario(s) x ${iterations} iterations${mock ? ' [mock]' : ''}\n`);

    const mockExecutor = new MockExecutor();
    const runner = new ScenarioRunner(config);
    const allResults: RunResult[] = [];

    for (let i = 1; i <= iterations; i++) {
      console.log(`\n--- Iteration ${i}/${iterations} ---`);
      const iterCollector = new MetricsCollector();

      for (const scenario of scenarios) {
        let result: RunResult;
        if (mock) {
          result = await mockExecutor.run(scenario, { timeout_minutes: timeout });
        } else {
          result = await runner.run(scenario, { timeout_minutes: timeout });
        }
        iterCollector.add(result);
        allResults.push(result);
        reporter.reportRun(result);
      }

      const iterMetrics = iterCollector.getAggregate();
      curve.addIteration(i, iterMetrics);
    }

    // Final aggregate
    const totalCollector = new MetricsCollector();
    totalCollector.addAll(allResults);
    const aggregate = totalCollector.getAggregate();

    reporter.reportAggregate(aggregate);
    reporter.reportLearningCurve(curve.getCurve());

    const improvement = curve.getImprovement();
    if (improvement) {
      console.log(`\nImprovement:`);
      console.log(`  Success rate: ${improvement.success_rate_delta >= 0 ? '+' : ''}${(improvement.success_rate_delta * 100).toFixed(1)}%`);
      if (improvement.accuracy_delta !== null) {
        console.log(`  Accuracy:     ${improvement.accuracy_delta >= 0 ? '+' : ''}${improvement.accuracy_delta.toFixed(3)}`);
      }
    }

    if (opts.output) {
      const writer = new ResultsWriter();
      const path = await writer.write(allResults, aggregate, String(opts.output), curve.getCurve());
      console.log(`\nResults saved to: ${path}`);
    }

    process.exit(aggregate.failure_count > 0 ? 1 : 0);
  });

// ============================================
// report command
// ============================================

program
  .command('report')
  .argument('<file>', 'Results JSON file to display')
  .description('Display results from a previous run')
  .action(async (file: string) => {
    const formatter = new ReportFormatter();
    await formatter.format(resolve(file));
  });

program.parse();
