import { mull, type MullPipelineOptions } from './mull.js';
import type {
  MullAdapter,
  MullAllResult,
  SessionRef,
  SessionProcessingResult,
  PipelineError,
} from './domain/types.js';

// ---------------------------------------------------------------------------
// MullAllOptions
// ---------------------------------------------------------------------------

export interface MullAllOptions extends MullPipelineOptions {
  // Future: parallel?: boolean (default sequential)
}

// ---------------------------------------------------------------------------
// mullAll() — batch pipeline function
// ---------------------------------------------------------------------------

/**
 * Execute the mull pipeline for all unprocessed sessions across all adapters.
 *
 * For each adapter:
 *   1. List all available sessions via adapter.listSessions()
 *   2. For each session, delegate to mull() which handles cursor-based
 *      filtering (sessions with no new messages return immediately)
 *   3. Aggregate results across all sessions
 *
 * Sessions are processed sequentially. If one session fails, processing
 * continues with the remaining sessions.
 *
 * @param opts - Pipeline options (config overrides, adapters, dryRun, force)
 * @returns MullAllResult with aggregate counts and per-session results
 */
export async function mullAll(opts: MullAllOptions = {}): Promise<MullAllResult> {
  const adapters = opts.adapters;
  if (!adapters || adapters.length === 0) {
    throw new Error(
      'No adapters provided. Pass adapters via MullAllOptions.adapters. ' +
      'Adapter creation from config is handled by resolveAdapters() (see config module).'
    );
  }

  // Collect all session refs from all adapters
  const allSessionRefs = await collectSessionRefs(adapters);

  // Process each session sequentially
  const sessions: SessionProcessingResult[] = [];
  let totalTopicsUpdated = 0;
  let totalTopicsCreated = 0;
  let totalNuggetsWritten = 0;
  const allErrors: PipelineError[] = [];
  let sessionsProcessed = 0;
  let sessionsSkipped = 0;
  let sessionsFailed = 0;

  for (const ref of allSessionRefs) {
    let result;
    let success = true;

    try {
      result = await mull(ref, opts);

      // A session with no nuggets written and no non-recoverable errors
      // was already up-to-date (cursor matched, no new messages)
      const hadWork = result.nuggetsWritten > 0 || result.errors.some(e => !e.recoverable);
      if (hadWork) {
        if (result.errors.some(e => !e.recoverable)) {
          sessionsFailed++;
          success = false;
        } else {
          sessionsProcessed++;
        }
      } else {
        sessionsSkipped++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result = {
        topicsUpdated: 0,
        topicsCreated: 0,
        nuggetsWritten: 0,
        errors: [{
          stage: 'load' as const,
          message: `Session processing failed: ${message}`,
          recoverable: false,
        }],
      };
      sessionsFailed++;
      success = false;
    }

    totalTopicsUpdated += result.topicsUpdated;
    totalTopicsCreated += result.topicsCreated;
    totalNuggetsWritten += result.nuggetsWritten;
    allErrors.push(...result.errors);

    sessions.push({ ref, success, result });
  }

  return {
    topicsUpdated: totalTopicsUpdated,
    topicsCreated: totalTopicsCreated,
    nuggetsWritten: totalNuggetsWritten,
    errors: allErrors,
    sessions,
    sessionsProcessed,
    sessionsSkipped,
    sessionsFailed,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collect session refs from all adapters, deduplicating by ref identity.
 */
async function collectSessionRefs(adapters: MullAdapter[]): Promise<SessionRef[]> {
  const seen = new Set<string>();
  const refs: SessionRef[] = [];

  for (const adapter of adapters) {
    const adapterRefs = await adapter.listSessions();
    for (const ref of adapterRefs) {
      const key = `${ref.type}:${ref.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push(ref);
      }
    }
  }

  return refs;
}
