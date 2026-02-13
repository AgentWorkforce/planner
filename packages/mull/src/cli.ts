#!/usr/bin/env tsx

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from './config/resolve.js';
import { createAdapterFromFlags, resolveAdapters } from './config/resolve-adapters.js';
import { mull } from './mull.js';
import { normalizeSessionRef } from './routing/session-ref-router.js';
import { formatDryRunOutput } from './cli/format-dry-run.js';
import type { MullConfig, AdapterConfig, MullAdapter, SessionRef } from './domain/types.js';
import type { SessionAdapter } from './adapters/core-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('mull')
  .version(readVersion())
  .description(
    'Cross-agent shared memory — extract knowledge from session data into topic files.\n\n' +
    'Reads session data from adapters (trajectory events, relay messages, transcripts),\n' +
    'extracts knowledge deterministically, synthesizes nuggets via LLM, and writes\n' +
    'structured markdown topic files to the memory directory.'
  )
  .argument('[session-id]', 'Session ID to process (omit for --all mode)')
  .option('--all', 'Process all unprocessed sessions from configured adapters')
  .option('--source <type>', 'Adapter source type (trajectory, relay, transcript)')
  .option('--dir <path>', 'Data directory for the adapter (used with --source)')
  .option('--path <path>', 'File path for transcript adapter (used with --source transcript)')
  .option('--dry-run', 'Preview extraction results without writing files')
  .option('--force', 'Re-process session ignoring existing cursor position')
  .option('--memory-dir <path>', 'Output directory for topic files (default: ./memory)')
  .option('--format <format>', 'Transcript format: markdown, jsonl, plaintext (used with --source transcript)')
  .action(async (sessionId: string | undefined, opts: {
    all?: boolean;
    source?: string;
    dir?: string;
    path?: string;
    dryRun?: boolean;
    force?: boolean;
    memoryDir?: string;
    format?: string;
  }) => {
    // Validate: must provide either session-id or --all
    if (!sessionId && !opts.all) {
      program.error('Provide a <session-id> or use --all to process all sessions.');
    }

    if (sessionId && opts.all) {
      program.error('Cannot specify both <session-id> and --all.');
    }

    // Validate: --format only valid with --source transcript
    if (opts.format && opts.source !== 'transcript') {
      program.error('--format is only valid with --source transcript.');
    }

    // Validate: --path only valid with --source transcript
    if (opts.path && opts.source !== 'transcript') {
      program.error('--path is only valid with --source transcript.');
    }

    // Validate: --source transcript requires --format
    if (opts.source === 'transcript' && !opts.format) {
      program.error('--source transcript requires --format (markdown, jsonl, or plaintext).');
    }

    // --- Config resolution ---
    // Build config overrides from CLI flags.
    // When --source is specified, override the adapters array with a single
    // adapter built from the CLI flags. When --memory-dir is specified,
    // override the memoryDir field.
    const configOverrides: Partial<MullConfig> = {};

    if (opts.memoryDir) {
      configOverrides.memoryDir = opts.memoryDir;
    }

    if (opts.source) {
      // CLI --source overrides the adapters array in config
      const adapterEntry: AdapterConfig = { type: opts.source };
      if (opts.dir) adapterEntry.dir = opts.dir;
      configOverrides.adapters = [adapterEntry];
    }

    // Resolve config: defaults → package.json → mull.config.json → CLI overrides
    const config = resolveConfig(configOverrides);

    // --- Adapter instantiation ---
    let adapters: SessionAdapter[];

    if (opts.source) {
      // Explicit --source flag: create adapter directly from CLI flags
      adapters = [
        createAdapterFromFlags(opts.source, opts.dir, opts.path, opts.format),
      ];
    } else {
      // No --source: instantiate adapters from resolved config
      adapters = resolveAdapters(config);
    }

    // --- Pipeline execution ---
    if (opts.all) {
      const mullAdapters = adapters as unknown as MullAdapter[];

      // Collect all session refs from all adapters, deduplicating
      const seen = new Set<string>();
      const allRefs: SessionRef[] = [];

      for (const adapter of mullAdapters) {
        const refs = await adapter.listSessions();
        for (const ref of refs) {
          const key = `${ref.type}:${ref.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            allRefs.push(ref);
          }
        }
      }

      // No sessions to process
      if (allRefs.length === 0) {
        console.log('No sessions to process.');
        process.exit(2);
      }

      console.log(`Found ${allRefs.length} session(s) across ${adapters.length} adapter(s).`);

      // Process each session with progress
      let sessionsProcessed = 0;
      let sessionsFailed = 0;
      let totalNuggets = 0;
      let totalTopicsCreated = 0;
      let totalTopicsUpdated = 0;
      const failedSessions: { ref: SessionRef; error: string }[] = [];

      let idx = 0;
      for (const ref of allRefs) {
        idx++;
        console.log(`\n[${idx}/${allRefs.length}] ${ref.id}`);

        try {
          const result = await mull(ref, {
            adapters: mullAdapters,
            config: configOverrides,
            dryRun: opts.dryRun,
            force: opts.force,
            onProgress: (update) => {
              const stageLabels: Record<string, string> = {
                loading: 'Loading session data',
                extracting: 'Extracting entities',
                synthesizing: 'Synthesizing nuggets',
                merging: 'Merging into topics',
                done: 'Done',
              };

              const label = stageLabels[update.stage] || update.stage;
              const counts = update.counts || {};

              if (update.stage === 'done') {
                console.log(
                  `  ✓ ${label}: ` +
                  `${counts.nuggets || 0} nuggets, ` +
                  `${counts.topicsCreated || 0} topics created, ` +
                  `${counts.topicsUpdated || 0} updated`,
                );
              } else if (counts.messages) {
                console.log(`  → ${label} (${counts.messages} messages)`);
              } else if (counts.nuggets) {
                console.log(`  → ${label} (${counts.nuggets} nuggets)`);
              } else {
                console.log(`  → ${label}`);
              }
            },
          });

          const fatal = result.errors.filter(e => !e.recoverable);
          if (fatal.length > 0) {
            sessionsFailed++;
            failedSessions.push({ ref, error: fatal[0]!.message });
          } else {
            sessionsProcessed++;
          }

          totalNuggets += result.nuggetsWritten;
          totalTopicsCreated += result.topicsCreated;
          totalTopicsUpdated += result.topicsUpdated;

          if (result.llmFailed) {
            console.warn(`  Warning: LLM synthesis failed for ${ref.id}, used deterministic fallback.`);
          }

          if (opts.dryRun && result.dryRunDetails) {
            console.log(formatDryRunOutput(result.dryRunDetails));
          }
        } catch (err) {
          sessionsFailed++;
          const message = err instanceof Error ? err.message : String(err);
          failedSessions.push({ ref, error: message });
          console.error(`  Error processing ${ref.id}: ${message}`);
        }
      }

      // Aggregate summary
      console.log('\n--- Batch Summary ---');
      console.log(`Sessions: ${allRefs.length} total, ${sessionsProcessed} processed, ${sessionsFailed} failed`);
      console.log(`Nuggets: ${totalNuggets} written`);
      console.log(`Topics: ${totalTopicsCreated} created, ${totalTopicsUpdated} updated`);

      // Report failures
      if (failedSessions.length > 0) {
        console.error('\nFailed sessions:');
        for (const { ref, error } of failedSessions) {
          console.error(`  - ${ref.id}: ${error}`);
        }
      }

      // Exit code: all failed = 1, some succeeded = 0
      if (sessionsFailed > 0 && sessionsProcessed === 0) {
        process.exit(1);
      }
    } else {
      console.log(`Processing session ${sessionId}...\n`);

      try {
        const sessionRef = normalizeSessionRef(sessionId!);
        const result = await mull(sessionRef, {
          adapters: adapters as unknown as MullAdapter[],
          config: configOverrides,
          dryRun: opts.dryRun,
          force: opts.force,
          onProgress: (update) => {
            const stageLabels: Record<string, string> = {
              loading: 'Loading session data',
              extracting: 'Extracting entities',
              synthesizing: 'Synthesizing nuggets',
              merging: 'Merging into topics',
              done: 'Done',
            };

            const label = stageLabels[update.stage] || update.stage;
            const counts = update.counts || {};

            if (update.stage === 'done') {
              console.log(
                `  ✓ ${label}: ` +
                `${counts.nuggets || 0} nuggets, ` +
                `${counts.topicsCreated || 0} topics created, ` +
                `${counts.topicsUpdated || 0} updated`,
              );
            } else if (counts.messages) {
              console.log(`  → ${label} (${counts.messages} messages)`);
            } else if (counts.nuggets) {
              console.log(`  → ${label} (${counts.nuggets} nuggets)`);
            } else {
              console.log(`  → ${label}`);
            }
          },
        });

        if (result.errors.length > 0) {
          const fatal = result.errors.filter(e => !e.recoverable);
          if (fatal.length > 0) {
            console.error(`Error: ${fatal[0]!.message}`);
            process.exit(1);
          }
          for (const err of result.errors) {
            console.warn(`Warning: [${err.stage}] ${err.message}`);
          }
        }

        if (result.llmFailed) {
          console.warn('Warning: LLM synthesis failed, used deterministic fallback.');
        }

        if (opts.dryRun && result.dryRunDetails) {
          console.log('\n' + formatDryRunOutput(result.dryRunDetails));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exit(1);
      }
    }
  });

program.parse();
