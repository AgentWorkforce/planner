/**
 * Question commands for Forge CLI
 *
 * Commands for managing agent questions: list, answer, dismiss.
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
  truncate,
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

const questionColumns: ColumnDef[] = [
  {
    header: 'ID',
    key: 'question_id',
    format: (v) => shortId(String(v)),
  },
  {
    header: 'Run',
    key: 'run_id',
    format: (v) => shortId(String(v)),
  },
  {
    header: 'Agent',
    key: 'agent_id',
    format: (v) => truncate(String(v), 15),
  },
  {
    header: 'Question',
    key: 'text',
    format: (v) => truncate(String(v), 40),
  },
  {
    header: 'Blocking',
    key: 'blocking_level',
    format: (v) => {
      const level = String(v);
      // Map to short display names
      const levelMap: Record<string, string> = {
        hard_block: 'HARD',
        soft_block: 'soft',
        preference: 'pref',
        fyi: 'fyi',
      };
      return levelMap[level] ?? level;
    },
  },
  {
    header: 'Priority',
    key: 'priority_score',
    format: (v) => String(v),
  },
  {
    header: 'Status',
    key: 'status',
    format: (v) => formatStatus(String(v)),
  },
];

const questionDetailKeys = [
  'question_id',
  'run_id',
  'task_id',
  'agent_id',
  'text',
  'options',
  'blocking_level',
  'steps_blocked',
  'cascade_depth',
  'can_use_default',
  'default_value',
  'subscribers',
  'status',
  'answer',
  'priority_score',
  'answered_by',
  'created_at',
  'answered_at',
];

// ============================================
// Command Handlers
// ============================================

/**
 * List pending questions
 */
async function listQuestions(options: GlobalOptions): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.listPendingQuestions();

    if (result.questions.length === 0) {
      console.log('No pending questions.');
      return;
    }

    output(
      result.questions as unknown as Record<string, unknown>[],
      options.format,
      questionColumns
    );

    if (options.format === 'table') {
      console.log(`\nTotal: ${result.questions.length} pending questions`);

      // Show summary of blocking levels
      const blockingCounts = result.questions.reduce(
        (acc, q) => {
          acc[q.blocking_level] = (acc[q.blocking_level] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const hardCount = blockingCounts['hard_block'] ?? 0;
      const softCount = blockingCounts['soft_block'] ?? 0;
      if (hardCount > 0 || softCount > 0) {
        console.log(
          `Blocking: ${hardCount} hard, ${softCount} soft`
        );
      }
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Answer a question
 */
async function answerQuestion(
  questionId: string,
  answer: string,
  options: GlobalOptions
): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.answerQuestion(questionId, answer);

    if (options.format === 'json') {
      output(result as unknown as Record<string, unknown>, options.format);
    } else {
      printSuccess(`Question ${shortId(questionId)} answered.`);
      console.log(`Answer: ${answer}`);
      console.log('');

      // Show subscribers that will be notified
      if (result.subscribers && result.subscribers.length > 0) {
        console.log(`Notifying ${result.subscribers.length} subscriber(s):`);
        for (const sub of result.subscribers) {
          console.log(`  - ${sub}`);
        }
        console.log('');
      }
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Dismiss a question
 */
async function dismissQuestion(
  questionId: string,
  options: GlobalOptions
): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.dismissQuestion(questionId);

    if (options.format === 'json') {
      output(result as unknown as Record<string, unknown>, options.format);
    } else {
      printSuccess(`Question ${shortId(questionId)} dismissed.`);

      // Warn about hard blocks
      if (result.blocking_level === 'hard_block') {
        console.log('');
        console.log(
          'Warning: This was a hard-blocking question. Associated tasks may remain blocked.'
        );
      }
    }
  } catch (error) {
    printError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Show details of a specific question
 */
async function showQuestion(
  questionId: string,
  options: GlobalOptions
): Promise<void> {
  try {
    const client = new ForgeApiClient(options.apiUrl);
    const result = await client.listPendingQuestions();

    // Find the question by ID (supports partial match)
    const question = result.questions.find(
      (q) =>
        q.question_id === questionId ||
        q.question_id.startsWith(questionId)
    );

    if (!question) {
      printError(`Question not found: ${questionId}`);
      process.exit(1);
    }

    if (options.format === 'json') {
      output(question as unknown as Record<string, unknown>, options.format);
    } else {
      console.log('Question Details:');
      console.log('');
      console.log(`ID: ${question.question_id}`);
      console.log(`Run: ${question.run_id}`);
      if (question.task_id) {
        console.log(`Task: ${question.task_id}`);
      }
      console.log(`Agent: ${question.agent_id}`);
      console.log('');
      console.log('Question:');
      console.log(`  ${question.text}`);
      console.log('');

      if (question.options && question.options.length > 0) {
        console.log('Options:');
        question.options.forEach((opt, i) => {
          console.log(`  ${i + 1}. ${opt}`);
        });
        console.log('');
      }

      console.log(`Blocking Level: ${question.blocking_level}`);
      console.log(`Priority Score: ${question.priority_score}`);
      console.log(`Steps Blocked: ${question.steps_blocked}`);
      console.log(`Cascade Depth: ${question.cascade_depth}`);
      console.log('');

      if (question.can_use_default && question.default_value) {
        console.log(`Default Value: ${question.default_value}`);
        console.log('');
      }

      console.log(`Status: ${question.status}`);
      console.log(`Created: ${formatDate(question.created_at)}`);

      if (question.subscribers && question.subscribers.length > 0) {
        console.log('');
        console.log(`Subscribers: ${question.subscribers.join(', ')}`);
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
 * Register question commands on the program
 */
export function registerQuestionCommands(program: Command): void {
  const question = program
    .command('question')
    .description('Manage agent questions');

  question
    .command('list')
    .description('List pending questions')
    .action(async () => {
      const globalOpts = program.opts() as GlobalOptions;
      await listQuestions(globalOpts);
    });

  question
    .command('show <question_id>')
    .description('Show details of a question')
    .action(async (questionId: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await showQuestion(questionId, globalOpts);
    });

  question
    .command('answer <question_id> <answer>')
    .description('Answer a question')
    .action(async (questionId: string, answer: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await answerQuestion(questionId, answer, globalOpts);
    });

  question
    .command('dismiss <question_id>')
    .description('Dismiss a question without answering')
    .action(async (questionId: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      await dismissQuestion(questionId, globalOpts);
    });
}
