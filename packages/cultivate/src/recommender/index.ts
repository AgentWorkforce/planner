/**
 * Recommendation Engine for Cultivate
 *
 * Generates AI-powered recommendations from clustered signals with caching.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { CultivateStorage } from '../storage/interface.js';
import type { Cluster, Signal } from '../domain/types.js';

export interface Recommendation {
  cluster_id: string;
  label: string;
  rank: number;
  summary: string;
  evidence: string[];     // key signal titles/excerpts supporting this recommendation
  confidence: number;     // 0-1
  action_hint?: string;   // suggested next action
}

export interface RecommendationCache {
  greenhouse_id: string;
  recommendations: Recommendation[];
  generated_at: string;
  expires_at: string;
}

export class RecommendationEngine {
  private cache = new Map<string, RecommendationCache>();
  private cacheTTL = 15 * 60 * 1000; // 15 minutes

  constructor(
    private storage: CultivateStorage,
    private anthropicApiKey?: string
  ) {}

  /**
   * Get recommendations for a greenhouse (uses cache if valid)
   */
  async getRecommendations(greenhouseId: string): Promise<Recommendation[]> {
    const cached = this.cache.get(greenhouseId);

    if (cached) {
      const now = new Date();
      const expiresAt = new Date(cached.expires_at);

      if (now < expiresAt) {
        console.log(`[RecommendationEngine] Cache hit for greenhouse ${greenhouseId}`);
        return cached.recommendations;
      }

      // Expired cache, remove it
      this.cache.delete(greenhouseId);
    }

    console.log(`[RecommendationEngine] Cache miss for greenhouse ${greenhouseId}, generating fresh`);
    return this.generateRecommendations(greenhouseId);
  }

  /**
   * Invalidate cache for a greenhouse (called when high-relevance signal arrives, score > 0.8)
   */
  invalidateCache(greenhouseId: string): void {
    const hadCache = this.cache.delete(greenhouseId);
    if (hadCache) {
      console.log(`[RecommendationEngine] Cache invalidated for greenhouse ${greenhouseId}`);
    }
  }

  /**
   * Generate fresh recommendations:
   * 1. Load all clusters for the greenhouse
   * 2. Filter: only clusters with signal_count >= 2
   * 3. Rank by: avg_relevance * (1 + velocity_weekly) — higher is better
   * 4. Take top 15 clusters
   * 5. Load sample signals (top 3 per cluster by score)
   * 6. Call Sonnet to produce 5 ranked recommendations with evidence
   * 7. Cache result
   */
  private async generateRecommendations(greenhouseId: string): Promise<Recommendation[]> {
    // If no API key, return empty recommendations
    if (!this.anthropicApiKey) {
      console.warn('[RecommendationEngine] No Anthropic API key, returning empty recommendations');
      return [];
    }

    // Step 1: Load all clusters for the greenhouse
    const allClusters = await this.storage.listClustersByGreenhouse(greenhouseId);

    // Step 2: Filter clusters with signal_count >= 2
    const eligibleClusters = allClusters.filter(c => c.signal_count >= 2);

    if (eligibleClusters.length === 0) {
      console.log(`[RecommendationEngine] No eligible clusters for greenhouse ${greenhouseId}`);
      return [];
    }

    // Step 3: Rank clusters by composite metric
    const rankedClusters = this.rankClusters(eligibleClusters);

    // Step 4: Take top 15 clusters
    const topClusters = rankedClusters.slice(0, 15);

    // Step 5: Load sample signals (top 3 per cluster by score)
    const clusterSignalMap = new Map<string, Signal[]>();

    for (const cluster of topClusters) {
      const signals = await this.storage.listSignals({
        greenhouse_id: greenhouseId,
        cluster_id: cluster.id,
        limit: 3,
        offset: 0,
      });

      // Sort by score descending
      const sortedSignals = signals.sort((a, b) => b.score - a.score);
      clusterSignalMap.set(cluster.id, sortedSignals);
    }

    // Step 6: Call Sonnet to produce recommendations
    const recommendations = await this.callSonnetForRecommendations(
      topClusters,
      clusterSignalMap
    );

    // Step 7: Cache result
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.cacheTTL);

    this.cache.set(greenhouseId, {
      greenhouse_id: greenhouseId,
      recommendations,
      generated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    return recommendations;
  }

  /**
   * Rank clusters by composite metric
   * Formula: signal_count * (1 + velocity_weekly)
   * Higher values are ranked first
   */
  private rankClusters(clusters: Cluster[]): Cluster[] {
    return [...clusters].sort((a, b) => {
      const scoreA = a.signal_count * (1 + (a.velocity_weekly || 0));
      const scoreB = b.signal_count * (1 + (b.velocity_weekly || 0));
      return scoreB - scoreA; // Descending
    });
  }

  /**
   * Call Sonnet to generate recommendations from clusters and signals
   */
  private async callSonnetForRecommendations(
    clusters: Cluster[],
    signalMap: Map<string, Signal[]>
  ): Promise<Recommendation[]> {
    const anthropic = new Anthropic({
      apiKey: this.anthropicApiKey,
    });

    // Build prompt with cluster summaries and sample signals
    let prompt = 'Given these signal clusters from user feedback:\n\n';

    clusters.forEach((cluster, index) => {
      const signals = signalMap.get(cluster.id) || [];
      const trendLabel = cluster.trend === 'rising' ? 'rising trend' :
                         cluster.trend === 'declining' ? 'declining trend' : 'stable';

      prompt += `CLUSTER ${index + 1}: "${cluster.label}" (${cluster.signal_count} signals, ${trendLabel})\n`;
      prompt += `Summary: ${cluster.summary}\n`;

      if (signals.length > 0) {
        prompt += 'Sample signals:\n';
        signals.forEach(signal => {
          prompt += `  - "${signal.title}" (score ${signal.score.toFixed(2)})\n`;
        });
      }

      prompt += '\n';
    });

    prompt += `
Generate exactly 5 ranked recommendations. For each:
- cluster_id: which cluster this recommendation is about
- summary: 2-3 sentence actionable recommendation
- evidence: array of key signal titles/excerpts supporting this
- confidence: 0-1 how confident this is worth acting on
- action_hint: suggested next step

Output JSON array only, no markdown formatting.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic');
      }

      // Parse JSON response
      const rawRecommendations = JSON.parse(content.text);

      // Validate and map to Recommendation interface
      const recommendations: Recommendation[] = rawRecommendations
        .slice(0, 5) // Ensure max 5
        .map((rec: any, index: number) => {
          // Find cluster to get label
          const cluster = clusters.find(c => c.id === rec.cluster_id);

          return {
            cluster_id: rec.cluster_id,
            label: cluster?.label || 'Unknown',
            rank: index + 1,
            summary: rec.summary || '',
            evidence: Array.isArray(rec.evidence) ? rec.evidence : [],
            confidence: typeof rec.confidence === 'number' ? rec.confidence : 0.5,
            action_hint: rec.action_hint,
          };
        });

      return recommendations;
    } catch (error) {
      console.error('[RecommendationEngine] Error calling Sonnet:', error);

      // Return empty on error rather than crashing
      return [];
    }
  }
}
