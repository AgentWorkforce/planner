#!/usr/bin/env node
/**
 * Forge CLI - Command-line interface for Forge operations
 *
 * Provides commands for viewing runs, trajectories, decisions,
 * and managing execution without UI.
 */

import { Command } from 'commander';
import { registerRunCommands } from './commands/run.js';
import { registerTrajectoryCommands } from './commands/trajectory.js';
import { registerGateCommands } from './commands/gate.js';
import { registerQuestionCommands } from './commands/question.js';

// Create main program
const program = new Command();

program
  .name('forge')
  .description('CLI for Forge orchestration operations')
  .version('0.1.0')
  .option(
    '--api-url <url>',
    'Forge API base URL',
    process.env['FORGE_API_URL'] ?? 'http://localhost:3456'
  )
  .option(
    '--format <format>',
    'Output format: table, json, or markdown',
    'table'
  );

// Register subcommands
registerRunCommands(program);
registerTrajectoryCommands(program);
registerGateCommands(program);
registerQuestionCommands(program);

// Parse and execute
program.parse();
