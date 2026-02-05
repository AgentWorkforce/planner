/**
 * Gate commands for Forge CLI
 *
 * Commands for managing human approval gates: list, approve, reject.
 */

import { Command } from 'commander';
import { ForgeApiClient } from '../api-client.js';
import {
  output,
  printError,
  printSuccess,
  formatDate,
  formatStatus,
  shortId,
  type ColumnDef,
  type OutputFormat,
} from '../formatters.js';

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

const gateColumns: ColumnDef[] = [
  {
    header: 'Task ID',
    key: 'task_id',
    format: (v) => shortId(String(v)),
  },
  {
    header: 'Run',
    key: 'run_id',
    format: (v) => shortId(String(v)),
  },
  {
    header: 'Step',
    key: 'step_title',
    format: (v) => String(v),
  },
  {
    header: 'Status',
    key: 'status',
    format: (v) => formatStatus(String(v)),
  },
  {
    header: 'Approver Role',
    key: 'approver_role',
    format: (v) => (v ? String(v) : '-'),
  },
  {
    header: 'Created',
    key: 'created_at',
    format: (v) => formatDate(String(v)),
  },
];

const gateDetailColumns: ColumnDef[] = [
  {
    header: 'Gate ID',
    key: 'gate_id',
    format: (v) => shortId(String(v)),
  },
  {
    header: 'Task ID',
    key: 'task_id',
    format: (v) => shortId(String(v)),
  },
  {
    header: 'Status',
    key: 'status',
    format: (v) => formatStatus(String(v)),
  },
  {
    header: 'Approver Role',
    key: 'approver_role',
    format: (v) => (v ? String(v) : '-'),
  },
  {
    header: 'Decided By',
    key: 'decided_by',
    format: (v) => (v ? String(v) : '-'),
  },
  {
    header: 'Decided At',
    key: 'decided_at',
    format: (v) => (v ? formatDate(String(v)) : '-'),
  },
  {
    header: 'Comment',
    key: 'comment',
    format: (v) => (v ? String(v) : '-'),
  },
];

// ============================================
// Command Handlers
// ============================================

/**
 * List pending gates
 */
async function listGates(options: GlobalOptions): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.listPendingGates();

    if (result.gates.length === 0) {
      console.log('No pending gates.');
      return;
    }

    output(
      result.gates as unknown as Record<string, unknown>[],
      options.format,
      gateColumns
    );

    if (options.format === 'table') {
      console.log(`\nTotal: ${result.gates.length} pending gates`);
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Approve a gate
 */
async function approveGate(
  taskId: string,
  options: GlobalOptions & { comment?: string }
): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.approveGate(taskId, options.comment);

    if (options.format === 'json') {
      output(result as unknown as Record<string, unknown>, options.format);
    } else {
      printSuccess(`Gate approved for task ${shortId(taskId)}`);
      if (options.comment) {
        console.log(`Comment: ${options.comment}`);
      }
      console.log('');
      output(
        result as unknown as Record<string, unknown>,
        options.format,
        gateDetailColumns
      );
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Reject a gate
 */
async function rejectGate(
  taskId: string,
  reason: string,
  options: GlobalOptions
): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.rejectGate(taskId, reason);

    if (options.format === 'json') {
      output(result as unknown as Record<string, unknown>, options.format);
    } else {
      printSuccess(`Gate rejected for task ${shortId(taskId)}`);
      console.log(`Reason: ${reason}`);
      console.log('');
      output(
        result as unknown as Record<string, unknown>,
        options.format,
        gateDetailColumns
      );
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
 * Register gate commands on the program
 */
export function registerGateCommands(program: Command): void {
  const gate = program
    .command('gate')
    .description('Manage human approval gates');

  gate
    .command('list')
    .description('List pending gates')
    .action(async () => {
      const globalOpts = program.opts() as GlobalOptions;
      await listGates(globalOpts);
    });

  gate
    .command('approve <task_id>')
    .description('Approve a gate')
    .option('-c, --comment <comment>', 'Optional comment for approval')
    .action(async (taskId: string, cmdOptions: { comment?: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      await approveGate(taskId, { ...globalOpts, ...cmdOptions });
    });

  gate
    .command('reject <task_id> <reason>')
    .description('Reject a gate with a reason')
    .action(async (taskId: string, reason: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await rejectGate(taskId, reason, globalOpts);
    });
}
