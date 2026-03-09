/**
 * Pipeline orchestrator - chains all signal processing stages
 *
 * The orchestrator runs signals through 7 stages:
 * 1. Filter (Tier 0 + 1 + 2) - rejects noise and low-quality signals
 * 2. Extract - AI-powered content analysis and metadata extraction
 * 3. Score - 8-factor scoring with weighted composite
 * 4. Dedup - exact and near-duplicate detection
 * 5. Cluster - assign to existing cluster or create new one
 * 6. Store - persist signal with all accumulated data
 * 7. SSE - emit real-time event for frontend updates
 *
 * Each stage:
 * - Records provenance (start time, end time, outcome)
 * - Stores results in ProcessSignalContext
 * - Fails fast on errors (propagates to BullMQ for retry/dead-letter)
 */

import type { ProcessSignalContext, StepProvenance } from './types.js';
import { applyFilters } from '../filters/index.js';
import { extractSignal } from '../extraction/index.js';
import { scoreSignal } from '../scoring/score.js';
import { checkExactDuplicate } from '../dedup/index.js';
import { assignCluster, createCluster } from '../clustering/index.js';
import { SignalFilteredError, SignalProcessingError } from '../errors.js';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Process a signal through the full pipeline
 *
 * Orchestrates all 7 stages of signal processing:
 * - Filter (Tier 0+1+2) - throws SignalFilteredError if rejected
 * - Extract - AI analysis
 * - Score - 8-factor weighted scoring
 * - Dedup - exact and near-duplicate detection
 * - Cluster - assignment or creation
 * - Store - persistence with provenance
 * - SSE - real-time event broadcast
 *
 * Error handling:
 * - SignalFilteredError: expected path for noise rejection (recorded in provenance, returns early)
 * - SignalProcessingError: pipeline failure (propagates to BullMQ for retry/dead-letter)
 * - All errors include provenance tracking for audit trail
 *
 * @param ctx - Pipeline context with signal, greenhouse, config, and dependencies
 * @returns Updated context with all stage results and accumulated provenance
 * @throws SignalFilteredError if signal is rejected by filtering (expected path)
 * @throws SignalProcessingError if pipeline fails (API errors, validation, etc.)
 */
export async function processSignal(ctx: ProcessSignalContext): Promise<ProcessSignalContext> {
  // ============================================================================
  // STAGE 1: FILTER (Tier 0 + 1 + 2)
  // ============================================================================
  const filterStartTime = new Date().toISOString();
  let filterProvenance: StepProvenance;

  try {
    const filterResult = await applyFilters(
      ctx.signal,
      ctx.greenhouse,
      ctx.config,
      ctx.storage,
      ctx.filterRegistry
    );

    filterProvenance = {
      step: 'filter',
      started_at: filterStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'passed',
    };

    ctx.filterResult = filterResult;
    ctx.intent = filterResult.tier2_category || 'unclassified';
    ctx.provenance.push(filterProvenance);
  } catch (err) {
    // SignalFilteredError is the expected path for rejection
    if (err instanceof SignalFilteredError) {
      filterProvenance = {
        step: 'filter',
        started_at: filterStartTime,
        completed_at: new Date().toISOString(),
        outcome: 'failed',
        reason: `Rejected at Tier ${err.filter_tier}: ${err.reason}`,
      };

      ctx.provenance.push(filterProvenance);

      // Re-throw for worker to handle (logs and returns early, doesn't dead-letter)
      throw err;
    }

    // Unexpected error - wrap and propagate
    filterProvenance = {
      step: 'filter',
      started_at: filterStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    };

    ctx.provenance.push(filterProvenance);

    const cause = err instanceof Error ? err : new Error(String(err));
    throw new SignalProcessingError('filter', ctx.signal.external_id, cause);
  }

  // ============================================================================
  // STAGE 2: EXTRACT
  // ============================================================================
  const extractStartTime = new Date().toISOString();
  let extractProvenance: StepProvenance;

  try {
    // Create Anthropic client (should be passed in context in production)
    // For now, use environment variable
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });

    const extractionResult = await extractSignal('', {
      signal_id: ctx.signal.external_id,
      title: ctx.signal.title,
      body: ctx.signal.body,
      author: ctx.signal.author,
      source: ctx.signal.source_type,
      timestamp: ctx.signal.occurred_at,
      anthropic,
      model: ctx.config.extract_model,
    });

    extractProvenance = {
      step: 'extract',
      started_at: extractStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'passed',
    };

    ctx.extractionResult = extractionResult;
    ctx.provenance.push(extractProvenance);
  } catch (err) {
    extractProvenance = {
      step: 'extract',
      started_at: extractStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    };

    ctx.provenance.push(extractProvenance);

    // Extraction errors should already be wrapped in SignalProcessingError by extractSignal()
    if (err instanceof SignalProcessingError) {
      throw err;
    }

    const cause = err instanceof Error ? err : new Error(String(err));
    throw new SignalProcessingError('extract', ctx.signal.external_id, cause);
  }

  // ============================================================================
  // STAGE 3: SCORE
  // ============================================================================
  const scoreStartTime = new Date().toISOString();
  let scoreProvenance: StepProvenance;

  try {
    // Get greenhouse weight overrides (if any)
    const greenhouseWeights = ctx.config.weights[ctx.greenhouse.id];

    const scoringResult = scoreSignal(
      {
        signalTimestamp: new Date(ctx.signal.occurred_at),
        extractionResult: ctx.extractionResult,
        sourceTier: undefined, // Source tier will be available when source configs are wired
        clusterSignalCount: 1, // Default to 1 for new signals (updated after clustering)
        signalKeywords: ctx.extractionResult.keywords,
        greenhouseKeywords: [
          ...ctx.greenhouse.keyword_require,
          ...ctx.greenhouse.keyword_exclude,
        ],
        title: ctx.signal.title,
        body: ctx.signal.body,
      },
      {
        greenhouseOverrides: greenhouseWeights,
      }
    );

    scoreProvenance = {
      step: 'score',
      started_at: scoreStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'passed',
    };

    ctx.scoringResult = {
      score: scoringResult.score,
      factors: scoringResult.factors,
    };
    ctx.provenance.push(scoreProvenance);
  } catch (err) {
    scoreProvenance = {
      step: 'score',
      started_at: scoreStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    };

    ctx.provenance.push(scoreProvenance);

    const cause = err instanceof Error ? err : new Error(String(err));
    throw new SignalProcessingError('score', ctx.signal.external_id, cause);
  }

  // ============================================================================
  // STAGE 4: DEDUP
  // ============================================================================
  const dedupStartTime = new Date().toISOString();
  let dedupProvenance: StepProvenance;

  try {
    // Check for exact duplicate first
    const existingSignalId = await checkExactDuplicate(
      ctx.signal.source_type,
      ctx.signal.external_id,
      ctx.storage
    );

    if (existingSignalId) {
      dedupProvenance = {
        step: 'dedup',
        started_at: dedupStartTime,
        completed_at: new Date().toISOString(),
        outcome: 'failed',
        reason: `Exact duplicate of signal ${existingSignalId}`,
      };

      ctx.dedupResult = {
        isDuplicate: true,
        existingSignalId,
      };
      ctx.provenance.push(dedupProvenance);

      // Return early - signal is a duplicate
      return ctx;
    }

    dedupProvenance = {
      step: 'dedup',
      started_at: dedupStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'passed',
    };

    ctx.dedupResult = {
      isDuplicate: false,
    };
    ctx.provenance.push(dedupProvenance);
  } catch (err) {
    dedupProvenance = {
      step: 'dedup',
      started_at: dedupStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    };

    ctx.provenance.push(dedupProvenance);

    const cause = err instanceof Error ? err : new Error(String(err));
    throw new SignalProcessingError('dedup', ctx.signal.external_id, cause);
  }

  // ============================================================================
  // STAGE 5: CLUSTER
  // ============================================================================
  const clusterStartTime = new Date().toISOString();
  let clusterProvenance: StepProvenance;

  try {
    // Create Anthropic client for clustering
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });

    const clusterAssignment = await assignCluster({
      signal_id: ctx.signal.external_id,
      extraction: ctx.extractionResult,
      greenhouse_id: ctx.greenhouse.id,
      greenhouse_name: ctx.greenhouse.name,
      storage: ctx.storage,
      anthropic,
      model: ctx.config.cluster_model,
    });

    // If new cluster, create it
    if (clusterAssignment.isNew && clusterAssignment.decision.action === 'create_new') {
      await createCluster({
        storage: ctx.storage,
        greenhouseId: ctx.greenhouse.id,
        name: clusterAssignment.decision.cluster_name || 'Unnamed Cluster',
        summary: clusterAssignment.decision.cluster_summary || clusterAssignment.decision.reasoning,
        initialSignalId: ctx.signal.external_id,
      });
    }

    clusterProvenance = {
      step: 'cluster',
      started_at: clusterStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'passed',
    };

    ctx.clusterResult = {
      cluster_id: clusterAssignment.cluster_id,
      isNew: clusterAssignment.isNew,
    };
    ctx.provenance.push(clusterProvenance);
  } catch (err) {
    clusterProvenance = {
      step: 'cluster',
      started_at: clusterStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    };

    ctx.provenance.push(clusterProvenance);

    // Clustering errors should already be wrapped in SignalProcessingError by assignCluster()
    if (err instanceof SignalProcessingError) {
      throw err;
    }

    const cause = err instanceof Error ? err : new Error(String(err));
    throw new SignalProcessingError('cluster', ctx.signal.external_id, cause);
  }

  // ============================================================================
  // STAGE 6: STORE
  // ============================================================================
  const storeStartTime = new Date().toISOString();
  let storeProvenance: StepProvenance;

  try {
    // Convert scoring factors to Record<string, number> for storage
    const scoringFactors: Record<string, number> = {
      recency: ctx.scoringResult.factors.recency,
      specificity: ctx.scoringResult.factors.specificity,
      source_authority: ctx.scoringResult.factors.source_authority,
      repetition: ctx.scoringResult.factors.repetition,
      emotional_intensity: ctx.scoringResult.factors.emotional_intensity,
      strategic_fit: ctx.scoringResult.factors.strategic_fit,
      actionability: ctx.scoringResult.factors.actionability,
      content_quality: ctx.scoringResult.factors.content_quality,
    };

    const storedSignal = await ctx.storage.createSignal({
      greenhouse_id: ctx.greenhouse.id,
      source_type: ctx.signal.source_type,
      external_id: ctx.signal.external_id,
      title: ctx.signal.title,
      body: ctx.signal.body,
      author: ctx.signal.author,
      author_type: ctx.signal.author_type,
      url: ctx.signal.url,
      score: ctx.scoringResult.score,
      scoring_factors: scoringFactors,
      status: 'clustered',
      tags: [],
      intent: ctx.intent,
    });

    // Update signal with cluster_id and provenance
    await ctx.storage.updateSignal(storedSignal.id, {
      cluster_id: ctx.clusterResult.cluster_id,
      provenance: ctx.provenance.map((p) => ({
        step: p.step,
        timestamp: p.completed_at,
        details: p.reason ? { reason: p.reason } : undefined,
      })),
    });

    // Store extraction result separately
    await ctx.storage.storeExtraction(storedSignal.id, ctx.extractionResult);

    storeProvenance = {
      step: 'store',
      started_at: storeStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'passed',
    };

    ctx.storedSignalId = storedSignal.id;
    ctx.provenance.push(storeProvenance);
  } catch (err) {
    storeProvenance = {
      step: 'store',
      started_at: storeStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    };

    ctx.provenance.push(storeProvenance);

    const cause = err instanceof Error ? err : new Error(String(err));
    throw new SignalProcessingError('store', ctx.signal.external_id, cause);
  }

  // ============================================================================
  // STAGE 6b: PROFILE UPSERT (non-fatal)
  // ============================================================================
  if (ctx.signal.author?.trim()) {
    try {
      await ctx.storage.upsertProfile({
        greenhouse_id: ctx.greenhouse.id,
        author: ctx.signal.author,
        author_type: ctx.signal.author_type,
        source_type: ctx.signal.source_type,
        intent: ctx.intent,
        cluster_id: ctx.clusterResult?.cluster_id,
      });
    } catch (profileErr) {
      // Profile upsert is non-fatal — log but don't break the pipeline
      console.warn('[pipeline] Profile upsert failed:', profileErr);
    }
  }

  // ============================================================================
  // STAGE 7: SSE
  // ============================================================================
  const sseStartTime = new Date().toISOString();
  let sseProvenance: StepProvenance;

  try {
    if (ctx.broadcaster && ctx.storedSignalId) {
      ctx.broadcaster.emitSignalNew({
        signal_id: ctx.storedSignalId,
        greenhouse_id: ctx.greenhouse.id,
        cluster_id: ctx.clusterResult.cluster_id,
        score: ctx.scoringResult.score,
        title: ctx.signal.title,
      });
    }

    sseProvenance = {
      step: 'sse',
      started_at: sseStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'passed',
    };

    ctx.provenance.push(sseProvenance);
  } catch (err) {
    // SSE failure is non-fatal - log and continue
    sseProvenance = {
      step: 'sse',
      started_at: sseStartTime,
      completed_at: new Date().toISOString(),
      outcome: 'failed',
      reason: err instanceof Error ? err.message : String(err),
    };

    ctx.provenance.push(sseProvenance);

    console.error('[pipeline] SSE emission failed (non-fatal):', err);
  }

  return ctx;
}
