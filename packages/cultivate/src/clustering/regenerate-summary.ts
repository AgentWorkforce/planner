/**
 * Cluster summary regeneration module
 *
 * Regenerates cluster summaries after every 5th signal to keep them accurate.
 * Uses Haiku to synthesize concise summaries from recent signals in the cluster.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { CultivateStorage } from '../storage/interface.js';

/**
 * Regenerate a cluster's summary after it accumulates signals.
 * Called when signal_count % 5 === 0 after assignment.
 * Uses Haiku to synthesize a concise summary from recent signals.
 *
 * @param clusterId - Cluster ID to regenerate summary for
 * @param greenhouseId - Greenhouse ID (for greenhouse-safe cluster access)
 * @param storage - Storage instance for fetching cluster and signals
 * @param anthropicApiKey - Anthropic API key (optional, skips if missing)
 * @returns The new summary (or existing summary if API key missing)
 */
export async function regenerateSummary(
  clusterId: string,
  greenhouseId: string,
  storage: CultivateStorage,
  anthropicApiKey?: string
): Promise<string> {
  // If no API key, skip regeneration and return existing summary
  if (!anthropicApiKey) {
    const cluster = await storage.getClusterByIdAndGreenhouse(clusterId, greenhouseId);
    return cluster?.summary || '';
  }

  // Load the cluster
  const cluster = await storage.getClusterByIdAndGreenhouse(clusterId, greenhouseId);
  if (!cluster) {
    throw new Error(
      `Cluster ${clusterId} not found in greenhouse ${greenhouseId} during summary regeneration`
    );
  }

  // Load the most recent 10 signals in this cluster
  const signals = await storage.listSignals({
    greenhouse_id: greenhouseId,
    cluster_id: clusterId,
    limit: 10,
    offset: 0,
  });

  // If no signals, return existing summary
  if (signals.length === 0) {
    return cluster.summary;
  }

  // Build a prompt for Haiku to synthesize a summary
  const signalDescriptions = signals
    .map((s, idx) => `${idx + 1}. ${s.title}\n   ${s.body.slice(0, 200)}...`)
    .join('\n\n');

  const prompt = `You are analyzing a cluster of related signals for a research greenhouse.

Cluster: "${cluster.label}"
Current summary: "${cluster.summary}"

Recent signals in this cluster (most recent 10):
${signalDescriptions}

Please synthesize a concise 2-3 sentence summary that captures the common themes and patterns across these signals. Focus on what makes this cluster coherent and distinct.

Respond with ONLY the summary text, no preamble or explanation.`;

  // Call Anthropic API
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract summary from response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Haiku for summary regeneration');
  }

  const newSummary = textContent.text.trim();

  // Update cluster summary in storage
  await storage.updateCluster(clusterId, { summary: newSummary });

  return newSummary;
}
