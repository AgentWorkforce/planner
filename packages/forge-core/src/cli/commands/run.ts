/**
 * Run commands for Forge CLI
 *
 * Commands for managing run lifecycle: start, list, status, pause, resume, cancel.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ForgeApiClient } from '../api-client.js';
import {
  output,
  printError,
  printSuccess,
  formatStatus,
  formatDate,
  shortId,
  type ColumnDef,
  type OutputFormat,
} from '../formatters.js';
import { ForgePlanSchema } from '../../domain/types.js';

// ============================================
// Types
// ============================================

interface GlobalOptions {
  apiUrl: string;
  format: OutputFormat;
}

// ============================================
// Column Definitions
// ============================================

const runColumns: ColumnDef[] = [
  {
    header: 'Run ID',
    key: 'run_id',
    format: (v) => shortId(String(v)),
  },
  {
    header: 'Plan ID',
    key: 'plan_id',
    format: (v) => shortId(String(v)),
  },
  { header: 'Status', key: 'status', format: (v) => formatStatus(String(v)) },
  { header: 'Created', key: 'created_at', format: (v) => formatDate(String(v)) },
];

const taskColumns: ColumnDef[] = [
  {
    header: 'Task ID',
    key: 'task_id',
    format: (v) => shortId(String(v)),
  },
  { header: 'Step', key: 'step_id' },
  { header: 'Title', key: 'step_title' },
  { header: 'Status', key: 'status', format: (v) => formatStatus(String(v)) },
  {
    header: 'Agent',
    key: 'agent_id',
    format: (v) => (v ? shortId(String(v)) : '-'),
  },
];

// ============================================
// Command Handlers
// ============================================

/**
 * Start a new run from a plan file
 */
async function startRun(planFile: string, options: GlobalOptions): Promise<void> {
  try {
    // Resolve file path
    const filePath = path.resolve(planFile);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      printError(`Plan file not found: ${filePath}`);
      process.exit(1);
    }

    // Read and parse plan file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let planData: unknown;
    try {
      planData = JSON.parse(fileContent);
    } catch {
      printError(`Invalid JSON in plan file: ${filePath}`);
      process.exit(1);
    }

    // Validate plan schema
    const parseResult = ForgePlanSchema.safeParse(planData);
    if (!parseResult.success) {
      printError(`Invalid plan format: ${parseResult.error.message}`);
      process.exit(1);
    }

    // Create run
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.startRun(parseResult.data);

    if (options.format === 'json') {
      output(result as unknown as Record<string, unknown>, options.format);
    } else {
      printSuccess(`Run created: ${result.run.run_id}`);
      console.log('');
      console.log('Run Details:');
      output(result.run as unknown as Record<string, unknown>, options.format, runColumns);
      console.log('');
      console.log('Tasks:');
      output(result.tasks as unknown as Record<string, unknown>[], options.format, taskColumns);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * List runs with optional status filter
 */
async function listRuns(options: GlobalOptions & { status?: string }): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.listRuns(options.status);

    if (result.runs.length === 0) {
      console.log('No runs found.');
      return;
    }

    output(result.runs as unknown as Record<string, unknown>[], options.format, runColumns);

    if (options.format === 'table') {
      console.log(`\nTotal: ${result.total} runs`);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Get status of a specific run
 */
async function getRunStatus(runId: string, options: GlobalOptions): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.getRun(runId);

    if (options.format === 'json') {
      output(result as unknown as Record<string, unknown>, options.format);
    } else {
      console.log('Run Details:');
      output(result.run as unknown as Record<string, unknown>, options.format, runColumns);
      console.log('');
      console.log('Tasks:');
      output(result.tasks as unknown as Record<string, unknown>[], options.format, taskColumns);

      // Summary
      if (options.format === 'table') {
        const statusCounts = result.tasks.reduce(
          (acc, task) => {
            acc[task.status] = (acc[task.status] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
        console.log('');
        console.log(
          'Task Summary:',
          Object.entries(statusCounts)
            .map(([s, c]) => `${s}: ${c}`)
            .join(', ')
        );
      }
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Pause a running run
 */
async function pauseRun(runId: string, options: GlobalOptions): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.pauseRun(runId);

    if (options.format === 'json') {
      output(result as unknown as Record<string, unknown>, options.format);
    } else {
      printSuccess(`Run ${shortId(runId)} paused.`);
      output(result as unknown as Record<string, unknown>, options.format, runColumns);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Resume a paused run
 */
async function resumeRun(runId: string, options: GlobalOptions): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.resumeRun(runId);

    if (options.format === 'json') {
      output(result as unknown as Record<string, unknown>, options.format);
    } else {
      printSuccess(`Run ${shortId(runId)} resumed.`);
      output(result as unknown as Record<string, unknown>, options.format, runColumns);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Cancel a run
 */
async function cancelRun(runId: string, options: GlobalOptions): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.cancelRun(runId);

    if (options.format === 'json') {
      output(result as unknown as Record<string, unknown>, options.format);
    } else {
      printSuccess(`Run ${shortId(runId)} cancelled.`);
      output(result as unknown as Record<string, unknown>, options.format, runColumns);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// ============================================
// Command Registration
// ============================================

/**
 * Register run commands on the program
 */
export function registerRunCommands(program: Command): void {
  const run = program
    .command('run')
    .description('Manage Forge runs');

  run
    .command('start <plan.json>')
    .description('Start a new run from a plan file')
    .action(async (planFile: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await startRun(planFile, globalOpts);
    });

  run
    .command('list')
    .description('List runs')
    .option('-s, --status <status>', 'Filter by status (pending, running, paused, completed, failed, cancelled)')
    .action(async (cmdOptions: { status?: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      await listRuns({ ...globalOpts, ...cmdOptions });
    });

  run
    .command('status <run_id>')
    .description('Get run status and task list')
    .action(async (runId: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await getRunStatus(runId, globalOpts);
    });

  run
    .command('pause <run_id>')
    .description('Pause a running run')
    .action(async (runId: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await pauseRun(runId, globalOpts);
    });

  run
    .command('resume <run_id>')
    .description('Resume a paused run')
    .action(async (runId: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await resumeRun(runId, globalOpts);
    });

  run
    .command('cancel <run_id>')
    .description('Cancel a run')
    .action(async (runId: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await cancelRun(runId, globalOpts);
    });
}
