import { resolveConfig } from './config/resolve.js';
import { buildPreExtract } from './pipeline/extract.js';
import { synthesizeNuggets } from './pipeline/synthesize.js';
import { extractTrailDecisions } from './pipeline/extract-trail-decisions.js';
import { extractDryRunDetails } from './pipeline/extract-dry-run-details.js';
import { FileTopicStore } from './defaults/topic-store.js';
import { LlmSynthesizer } from './synthesizers/llm-synthesizer.js';
import { routeSessionRef } from './routing/session-ref-router.js';
import type {
  SessionRef,
  MullOptions,
  MullResult,
  MullAdapter,
  MullConfig,
  Nugget,
  NuggetSynthesizer,
  TopicStore,
  PipelineError,
} from './domain/types.js';

// ---------------------------------------------------------------------------
// Extended options with pluggable pipeline components
// ---------------------------------------------------------------------------

export interface MullPipelineOptions extends MullOptions {
  /** Custom synthesizer. Defaults to LlmSynthesizer. */
  synthesizer?: NuggetSynthesizer;

  /** Custom topic store. Defaults to FileTopicStore. */
  topicStore?: TopicStore;
}

// ---------------------------------------------------------------------------
// Empty result helper
// ---------------------------------------------------------------------------

const EMPTY_RESULT: MullResult = {
  topicsUpdated: 0,
  topicsCreated: 0,
  nuggetsWritten: 0,
  errors: [],
  llmFailed: false,
};

// ---------------------------------------------------------------------------
// mull() — main pipeline function
// ---------------------------------------------------------------------------

/**
 * Execute the full mull pipeline for a single session.
 *
 * Pipeline stages:
 *   1. Resolve config (merge opts with defaults)
 *   2. Route SessionRef to the correct adapter
 *   3. Load session data (respecting cursor unless force=true)
 *   4. Build PreExtract (enrich with existing topic context)
 *   5. Synthesize nuggets — if LLM fails, falls back to trail decision
 *      nuggets (deterministic extraction from messages, confidence=0.3)
 *   6. Merge nuggets into topic files (skipped if dryRun)
 *   7. Rebuild TOC index (skipped if dryRun)
 *   8. Update cursor (skipped if dryRun)
 *
 * **Partial failure guarantee**: If LLM synthesis throws, pre-structured
 * trail decision nuggets are still written. The pipeline continues through
 * merge, TOC rebuild, and cursor update. MullResult.llmFailed is set to true.
 *
 * **Idempotency**: Same adapters + same cursor state + same source data
 * produces identical output in topic files (deduplication via slug-based merge).
 *
 * @param sessionRef - Identifies the session to process (plan_id, run_id, or channel)
 * @param opts - Pipeline options (config overrides, adapters, dryRun, force)
 * @returns MullResult with counts, pipeline errors, and llmFailed flag
 */
export async function mull(
  sessionRef: SessionRef,
  opts: MullPipelineOptions = {},
): Promise<MullResult> {
  const errors: PipelineError[] = [];
  const onProgress = opts.onProgress;

  // 1. Resolve config
  const config: MullConfig = resolveConfig(opts.config);

  // Resolve pipeline components (use defaults if not provided)
  const synthesizer: NuggetSynthesizer = opts.synthesizer ?? new LlmSynthesizer();
  const topicStore: TopicStore = opts.topicStore ?? new FileTopicStore();

  // 2. Route to correct adapter
  const adapters = opts.adapters;
  if (!adapters || adapters.length === 0) {
    throw new Error(
      'No adapters provided. Pass adapters via MullOptions.adapters. ' +
      'Adapter creation from config is handled by resolveAdapters() (see config module).'
    );
  }

  const adapter = routeSessionRef(sessionRef, adapters);

  // 3. Load session data (respecting cursor unless force mode)
  onProgress?.({ stage: 'loading', sessionId: sessionRef.id });

  let cursor: string | null = null;
  if (!opts.force) {
    try {
      cursor = await adapter.getCursor(sessionRef);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        stage: 'load',
        message: `Failed to read cursor: ${message}`,
        recoverable: true,
      });
      // Continue without cursor — will process all messages
    }
  }

  let sessionData;
  try {
    sessionData = await adapter.loadSession(
      sessionRef,
      cursor ? { after: cursor } : undefined,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...EMPTY_RESULT,
      errors: [{
        stage: 'load',
        message: `Failed to load session: ${message}`,
        recoverable: false,
      }],
    };
  }

  // No new messages to process
  if (sessionData.messages.length === 0) {
    onProgress?.({ stage: 'done', sessionId: sessionRef.id, counts: {} });
    return { ...EMPTY_RESULT, errors };
  }

  // 4. Build PreExtract
  onProgress?.({
    stage: 'extracting',
    sessionId: sessionRef.id,
    counts: { messages: sessionData.messages.length },
  });

  let preExtract;
  try {
    preExtract = await buildPreExtract(sessionData, config, topicStore);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...EMPTY_RESULT,
      errors: [...errors, {
        stage: 'extract',
        message: `Failed to build PreExtract: ${message}`,
        recoverable: false,
      }],
    };
  }

  // 5. Synthesize nuggets (with partial failure fallback to trail decisions)
  onProgress?.({
    stage: 'synthesizing',
    sessionId: sessionRef.id,
    counts: { messages: preExtract.messages.length },
  });

  const synthesisResult = await synthesizeNuggets(preExtract, config, synthesizer);
  errors.push(...synthesisResult.errors);

  let nuggets: Nugget[] = synthesisResult.nuggets;
  let llmFailed = false;

  // If LLM synthesis produced no nuggets (failure), fall back to trail decision
  // shortcut: deterministic extraction of pre-structured nuggets from messages.
  // This ensures data is never lost — trail decisions are always written.
  if (nuggets.length === 0 && preExtract.messages.length > 0) {
    const hasSynthesisError = synthesisResult.errors.some(e => e.stage === 'synthesize');
    if (hasSynthesisError) {
      llmFailed = true;
      nuggets = extractTrailDecisions(preExtract);
    }
  }

  // 6. Dry run: return extraction details — always, even with 0 nuggets.
  //    That's how you diagnose and tune the pipeline.
  if (opts.dryRun) {
    const uniqueTopics = new Set(nuggets.map(n => n.topic));
    const dryRunDetails = extractDryRunDetails(preExtract, nuggets);
    onProgress?.({
      stage: 'done',
      sessionId: sessionRef.id,
      counts: {
        nuggets: nuggets.length,
        topicsUpdated: uniqueTopics.size,
      },
    });
    return {
      topicsUpdated: uniqueTopics.size,
      topicsCreated: 0,
      nuggetsWritten: nuggets.length,
      errors,
      llmFailed,
      dryRunDetails,
    };
  }

  if (nuggets.length === 0) {
    onProgress?.({
      stage: 'done',
      sessionId: sessionRef.id,
      counts: { nuggets: 0 },
    });
    return { ...EMPTY_RESULT, llmFailed, errors };
  }

  // 7. Merge nuggets into topic files
  onProgress?.({
    stage: 'merging',
    sessionId: sessionRef.id,
    counts: { nuggets: nuggets.length },
  });

  let mergeResult;
  try {
    mergeResult = await topicStore.merge(nuggets, config.memoryDir, sessionRef.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...EMPTY_RESULT,
      llmFailed,
      errors: [...errors, {
        stage: 'merge',
        message: `Failed to merge topics: ${message}`,
        recoverable: false,
      }],
    };
  }

  // 8. Rebuild TOC
  try {
    await topicStore.rebuildToc(config.memoryDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push({
      stage: 'toc',
      message: `Failed to rebuild TOC: ${message}`,
      recoverable: true,
    });
    // Non-fatal: nuggets were already written, TOC is secondary
  }

  // 9. Update cursor
  const lastMessage = sessionData.messages[sessionData.messages.length - 1];
  if (lastMessage) {
    try {
      await adapter.setCursor(sessionRef, lastMessage.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({
        stage: 'cursor',
        message: `Failed to update cursor: ${message}`,
        recoverable: true,
      });
      // Non-fatal: data was written, but next run may reprocess some messages
    }
  }

  onProgress?.({
    stage: 'done',
    sessionId: sessionRef.id,
    counts: {
      nuggets: mergeResult.nuggetsWritten,
      topicsCreated: mergeResult.topicsCreated,
      topicsUpdated: mergeResult.topicsUpdated,
    },
  });

  return {
    topicsUpdated: mergeResult.topicsUpdated,
    topicsCreated: mergeResult.topicsCreated,
    nuggetsWritten: mergeResult.nuggetsWritten,
    errors,
    llmFailed,
  };
}
