/**
 * Trajectory commands for Forge CLI
 *
 * Commands for viewing and exporting trajectory events: show, export, decisions.
 */

import { Command } from 'commander';
import { ForgeApiClient } from '../api-client.js';
import {
  output,
  printError,
  formatTime,
  shortId,
  truncate,
  type ColumnDef,
  type OutputFormat,
} from '../formatters.js';
import type { TrajectoryEvent } from '../../domain/types.js';

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

const eventColumns: ColumnDef[] = [
  {
    header: 'Time',
    key: 'timestamp',
    format: (v) => formatTime(String(v)),
  },
  {
    header: 'Type',
    key: 'event_type',
    format: (v) => String(v),
  },
  {
    header: 'Task',
    key: 'task_id',
    format: (v) => (v ? shortId(String(v)) : '-'),
  },
  {
    header: 'Summary',
    key: 'payload',
    format: (v) => {
      const payload = v as Record<string, unknown>;
      // Extract meaningful summary from payload based on common fields
      const summary =
        payload['message'] ??
        payload['summary'] ??
        payload['decision'] ??
        payload['error'] ??
        payload['status'] ??
        '';
      return truncate(String(summary), 50);
    },
  },
];

const decisionColumns: ColumnDef[] = [
  {
    header: 'Time',
    key: 'timestamp',
    format: (v) => formatTime(String(v)),
  },
  {
    header: 'Task',
    key: 'task_id',
    format: (v) => (v ? shortId(String(v)) : '-'),
  },
  {
    header: 'Decision',
    key: 'payload',
    format: (v) => {
      const payload = v as Record<string, unknown>;
      const decision = payload['summary'] ?? payload['decision'] ?? '';
      return truncate(String(decision), 60);
    },
  },
  {
    header: 'Rationale',
    key: 'payload',
    format: (v) => {
      const payload = v as Record<string, unknown>;
      const rationale = payload['rationale'] ?? payload['reason'] ?? '';
      return truncate(String(rationale), 40);
    },
  },
];

// ============================================
// Command Handlers
// ============================================

/**
 * Show trajectory events for a run
 */
async function showTrajectory(
  runId: string,
  options: GlobalOptions & {
    taskId?: string;
    eventType?: string;
    limit?: string;
  }
): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.getTrajectory(runId, {
      taskId: options.taskId,
      eventType: options.eventType,
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
    });

    if (result.events.length === 0) {
      console.log('No trajectory events found.');
      return;
    }

    output(
      result.events as unknown as Record<string, unknown>[],
      options.format,
      eventColumns
    );

    if (options.format === 'table') {
      console.log(`\nTotal: ${result.total} events`);
      if (result.has_more) {
        console.log('(More events available. Use --limit to increase.)');
      }
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Export trajectory for a run
 */
async function exportTrajectory(
  runId: string,
  options: GlobalOptions & { exportFormat?: string }
): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const exportFormat =
      (options.exportFormat as 'json' | 'markdown') ?? 'json';
    const result = await client.exportTrajectory(runId, exportFormat);

    if (typeof result === 'string') {
      // Markdown format
      console.log(result);
    } else {
      // JSON format
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Show decision events for a run
 */
async function showDecisions(
  runId: string,
  options: GlobalOptions
): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.getTrajectory(runId, {
      eventType: 'decision_recorded',
      limit: 100,
    });

    if (result.events.length === 0) {
      console.log('No decisions recorded for this run.');
      return;
    }

    output(
      result.events as unknown as Record<string, unknown>[],
      options.format,
      decisionColumns
    );

    if (options.format === 'table') {
      console.log(`\nTotal: ${result.events.length} decisions`);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Search trajectory events across runs
 */
async function searchTrajectory(
  query: string,
  options: GlobalOptions & { runId?: string }
): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const results = await client.searchTrajectory(query, options.runId);

    if (results.length === 0) {
      console.log(`No events matching "${query}" found.`);
      return;
    }

    // Add run_id to column display for cross-run search
    const searchColumns: ColumnDef[] = options.runId
      ? eventColumns
      : [
          {
            header: 'Run',
            key: 'run_id',
            format: (v) => shortId(String(v)),
          },
          ...eventColumns,
        ];

    output(
      results as unknown as Record<string, unknown>[],
      options.format,
      searchColumns
    );

    if (options.format === 'table') {
      console.log(`\nFound ${results.length} matching events`);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Show trajectory statistics for a run
 */
async function showStats(runId: string, options: GlobalOptions): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const stats = await client.getTrajectoryStats(runId);

    if (options.format === 'json') {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log(`Trajectory Statistics for Run ${shortId(runId)}`);
      console.log('');
      console.log(`Total Events: ${stats.total_events}`);
      if (stats.first_event) {
        console.log(`First Event: ${formatTime(stats.first_event)}`);
      }
      if (stats.last_event) {
        console.log(`Last Event: ${formatTime(stats.last_event)}`);
      }
      console.log('');
      console.log('Events by Type:');
      for (const [type, count] of Object.entries(stats.events_by_type)) {
        console.log(`  ${type}: ${count}`);
      }
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
 * Register trajectory commands on the program
 */
export function registerTrajectoryCommands(program: Command): void {
  const trajectory = program
    .command('trajectory')
    .description('View and export trajectory events');

  trajectory
    .command('show <run_id>')
    .description('Show trajectory events for a run')
    .option('-t, --task-id <task_id>', 'Filter by task ID')
    .option('-e, --event-type <type>', 'Filter by event type')
    .option('-l, --limit <number>', 'Limit number of events', '50')
    .action(
      async (
        runId: string,
        cmdOptions: { taskId?: string; eventType?: string; limit?: string }
      ) => {
        const globalOpts = program.opts() as GlobalOptions;
        await showTrajectory(runId, { ...globalOpts, ...cmdOptions });
      }
    );

  trajectory
    .command('export <run_id>')
    .description('Export full trajectory for a run')
    .option(
      '-f, --export-format <format>',
      'Export format: json or markdown',
      'json'
    )
    .action(async (runId: string, cmdOptions: { exportFormat?: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      await exportTrajectory(runId, { ...globalOpts, ...cmdOptions });
    });

  trajectory
    .command('decisions <run_id>')
    .description('Show decision events for a run')
    .action(async (runId: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await showDecisions(runId, globalOpts);
    });

  trajectory
    .command('search <query>')
    .description('Search trajectory events across runs')
    .option('-r, --run-id <run_id>', 'Limit search to a specific run')
    .action(async (query: string, cmdOptions: { runId?: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      await searchTrajectory(query, { ...globalOpts, ...cmdOptions });
    });

  trajectory
    .command('stats <run_id>')
    .description('Show trajectory statistics for a run')
    .action(async (runId: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await showStats(runId, globalOpts);
    });
}
