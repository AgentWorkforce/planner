/**
 * Signal clustering module
 *
 * Core clustering pipeline that calls Anthropic SDK to analyze extracted signal
 * data and assign signals to existing clusters or recommend creating new clusters.
 *
 * Uses the ClusterAssignmentDecision schema to determine cluster assignment,
 * enforcing Greenhouse isolation by only querying clusters for the target greenhouse.
 *
 * Error handling: All clustering failures (LLM API errors, validation failures, etc.)
 * are wrapped in SignalProcessingError for BullMQ dead-letter routing.
 */

import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import type { ExtractionResult, Cluster } from '../domain/types.js';
import { SignalProcessingError } from '../errors.js';
import type { CultivateStorage } from '../storage/interface.js';
import {
  CLUSTER_ASSIGNMENT_SYSTEM_PROMPT,
  createClusterAssignmentUserPrompt,
  ClusterAssignmentDecisionSchema,
  type ClusterAssignmentDecision,
} from '../prompts/cluster-assignment-prompt.js';

/**
 * Result of cluster assignment decision
 * Contains the cluster ID (existing or new) and whether it's a new cluster
 */
export interface ClusterAssignment {
  /** ID of the cluster to assign the signal to (UUID for new clusters) */
  cluster_id: string;

  /** Whether this is a newly recommended cluster (not yet created in storage) */
  isNew: boolean;

  /** The original decision from the LLM for context and logging */
  decision: ClusterAssignmentDecision;
}

/**
 * Context required for cluster assignment
 * Includes signal metadata, extraction results, and dependencies
 */
export interface ClusteringContext {
  /** Signal ID for error tracking and correlation */
  signal_id: string;

  /** Extracted signal data with summary, keywords, aspects, entities */
  extraction: ExtractionResult;

  /** Target Greenhouse ID (enforces Greenhouse isolation) */
  greenhouse_id: string;

  /** Optional Greenhouse name for user prompt context */
  greenhouse_name?: string;

  /** Storage instance for fetching existing clusters */
  storage: CultivateStorage;

  /** Anthropic SDK client for making API calls */
  anthropic: Anthropic;

  /** Model name for clustering (default: claude-haiku-4-5-20251001) */
  model?: string;
}

/**
 * Assign a signal to a cluster or recommend creating a new one
 *
 * This function analyzes extracted signal data and determines the best cluster assignment:
 * 1. Fetches existing clusters for the target Greenhouse (enforces isolation)
 * 2. Calls Haiku with the cluster assignment prompt including signal data and clusters
 * 3. Parses the response as ClusterAssignmentDecision using JSON schema validation
 * 4. Returns ClusterAssignment with cluster_id and isNew flag
 *
 * The function guarantees Greenhouse isolation by:
 * - Only querying clusters belonging to the specified greenhouse_id
 * - Not mixing signals from different greenhouses in clustering decisions
 * - Validating that returned cluster_id (if "assign") belongs to the target greenhouse
 *
 * Error handling (for BullMQ dead-letter routing):
 * - LLM API errors (network, auth, rate limits) are wrapped in SignalProcessingError
 * - Validation failures are wrapped in SignalProcessingError
 * - Cluster isolation violations throw an error
 * - Errors propagate cleanly without try/catch swallowing
 * - BullMQ worker catches SignalProcessingError for retry and dead-letter routing
 *
 * @param context - Clustering context with signal metadata, extraction, and dependencies
 * @returns ClusterAssignment with cluster_id and isNew flag
 * @throws SignalProcessingError if clustering fails (API error, validation, isolation violation)
 *
 * @example
 * ```typescript
 * const assignment = await assignCluster({
 *   signal_id: 'sig-123',
 *   extraction: {
 *     summary: 'API performance issue',
 *     keywords: ['API', 'slow', 'response'],
 *     aspects: ['performance', 'reliability'],
 *     entities: [],
 *     quotes: [],
 *     reasoning: '...',
 *     specificity: 0.8,
 *     emotional_intensity: 0.6,
 *     actionability: 0.7,
 *   },
 *   greenhouse_id: 'gh-456',
 *   storage: storageInstance,
 *   anthropic: anthropicClient,
 * });
 *
 * console.log(`Assigned to cluster: ${assignment.cluster_id}, isNew: ${assignment.isNew}`);
 * ```
 */
export async function assignCluster(context: ClusteringContext): Promise<ClusterAssignment> {
  const {
    signal_id,
    extraction,
    greenhouse_id,
    greenhouse_name,
    storage,
    anthropic,
    model = 'claude-haiku-4-5-20251001',
  } = context;

  // Step 1: Fetch existing clusters for this Greenhouse
  // Enforces Greenhouse isolation by only querying clusters for the target greenhouse_id
  let existingClusters: Cluster[];
  try {
    existingClusters = await storage.listClustersByGreenhouse(greenhouse_id);
  } catch (storageError) {
    const cause =
      storageError instanceof Error ? storageError : new Error(String(storageError));
    throw new SignalProcessingError('tier3-clustering', signal_id, cause);
  }

  // Step 2: Create user prompt with signal extraction and existing clusters
  const userPrompt = createClusterAssignmentUserPrompt({
    signal: {
      summary: extraction.summary,
      keywords: extraction.keywords,
      aspects: extraction.aspects,
      entities: (extraction.entities || []) as Array<{ name: string; type: string }>,
    },
    existingClusters: existingClusters.map((c) => ({
      id: c.id,
      label: c.label,
      summary: c.summary,
      signal_count: c.signal_count,
    })),
    greenhouseName: greenhouse_name,
  });

  // Step 3: Call Anthropic API for cluster assignment decision
  // The API response must be valid JSON matching ClusterAssignmentDecisionSchema
  let response;
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: CLUSTER_ASSIGNMENT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });
  } catch (apiError) {
    // Wrap API errors (network, auth, rate limits, etc.) for BullMQ to handle
    const cause = apiError instanceof Error ? apiError : new Error(String(apiError));
    throw new SignalProcessingError('tier3-clustering', signal_id, cause);
  }

  // Step 4: Extract text content from response
  const textContent = response.content.find((block: any) => block.type === 'text');
  if (!textContent || (textContent as any).type !== 'text') {
    const responseTypes = response.content.map((c: any) => c.type).join(', ') || 'no content';
    const cause = new Error(
      `Expected text response from model, got ${responseTypes}`
    );
    throw new SignalProcessingError('tier3-clustering', signal_id, cause);
  }

  // Step 5: Parse JSON response and validate against schema
  let decision: ClusterAssignmentDecision;
  try {
    const textBlock = textContent as any;
    const parsedJson = JSON.parse(textBlock.text);
    decision = ClusterAssignmentDecisionSchema.parse(parsedJson);
  } catch (parseError) {
    const cause =
      parseError instanceof Error
        ? parseError
        : new Error(`Failed to parse cluster assignment response: ${String(parseError)}`);
    throw new SignalProcessingError('tier3-clustering', signal_id, cause);
  }

  // Step 6: Build ClusterAssignment result from decision
  let clusterAssignment: ClusterAssignment;

  if (decision.action === 'assign') {
    // Assigning to existing cluster
    // Validate that the cluster belongs to this greenhouse (isolation check)
    const targetCluster = existingClusters.find((c) => c.id === decision.cluster_id);
    if (!targetCluster) {
      const cause = new Error(
        `Cluster ${decision.cluster_id} not found in greenhouse ${greenhouse_id} (isolation violation)`
      );
      throw new SignalProcessingError('tier3-clustering', signal_id, cause);
    }

    clusterAssignment = {
      cluster_id: decision.cluster_id,
      isNew: false,
      decision,
    };
  } else {
    // Creating new cluster
    // Generate a UUID for the new cluster (will be created separately by the worker)
    const newClusterId = randomUUID();

    clusterAssignment = {
      cluster_id: newClusterId,
      isNew: true,
      decision,
    };
  }

  return clusterAssignment;
}
