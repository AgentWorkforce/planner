/**
 * Reclusterer - Review clusters and suggest merge/split/rename operations
 */

import Anthropic from '@anthropic-ai/sdk';
import type { CultivateStorage } from '../storage/interface.js';
import type { Cluster } from '../domain/types.js';

interface MergeOperation {
  type: 'merge';
  source_cluster_ids: string[];
  new_label: string;
  new_summary: string;
}

interface SplitOperation {
  type: 'split';
  cluster_id: string;
  groups: Array<{
    label: string;
    summary: string;
    signal_ids: string[];
  }>;
}

interface RenameOperation {
  type: 'rename';
  cluster_id: string;
  new_label: string;
  new_summary: string;
}

type ClusterOperation = MergeOperation | SplitOperation | RenameOperation;

export class Reclusterer {
  constructor(
    private storage: CultivateStorage,
    private anthropicApiKey?: string
  ) {}

  /**
   * Review clusters in a greenhouse and suggest merge/split/rename operations.
   * Uses Sonnet to analyze cluster summaries and overlap.
   *
   * Only runs if there are >= 3 clusters.
   *
   * Operations:
   * - merge: combine overlapping clusters, reassign signals
   * - split: break large clusters (>50 signals) into sub-clusters
   * - rename: update label when summary has drifted
   */
  async recluster(greenhouseId: string): Promise<{
    merged: number;
    split: number;
    renamed: number;
  }> {
    // If no API key, skip
    if (!this.anthropicApiKey) {
      console.warn('[Reclusterer] No Anthropic API key, skipping recluster');
      return { merged: 0, split: 0, renamed: 0 };
    }

    // Load all clusters for the greenhouse
    const clusters = await this.storage.listClustersByGreenhouse(greenhouseId);

    // Skip if < 3 clusters (nothing to merge/split)
    if (clusters.length < 3) {
      console.log(`[Reclusterer] Greenhouse ${greenhouseId} has < 3 clusters, skipping`);
      return { merged: 0, split: 0, renamed: 0 };
    }

    // Get suggested operations from Sonnet
    const operations = await this.getSuggestedOperations(greenhouseId, clusters);

    let mergedCount = 0;
    let splitCount = 0;
    let renamedCount = 0;

    // Apply each operation
    for (const operation of operations) {
      try {
        if (operation.type === 'merge') {
          await this.applyMerge(greenhouseId, operation);
          mergedCount++;
        } else if (operation.type === 'split') {
          await this.applySplit(greenhouseId, operation);
          splitCount++;
        } else if (operation.type === 'rename') {
          await this.applyRename(operation);
          renamedCount++;
        }
      } catch (error) {
        console.error(`[Reclusterer] Error applying operation:`, error);
      }
    }

    console.log(
      `[Reclusterer] Greenhouse ${greenhouseId}: ${mergedCount} merged, ` +
      `${splitCount} split, ${renamedCount} renamed`
    );

    return { merged: mergedCount, split: splitCount, renamed: renamedCount };
  }

  /**
   * Call Sonnet to suggest cluster operations
   */
  private async getSuggestedOperations(
    _greenhouseId: string,
    clusters: Cluster[]
  ): Promise<ClusterOperation[]> {
    const anthropic = new Anthropic({
      apiKey: this.anthropicApiKey,
    });

    // Build prompt with cluster summaries
    let prompt = 'Given these signal clusters:\n\n';

    for (const cluster of clusters) {
      prompt += `CLUSTER: "${cluster.label}" (${cluster.signal_count} signals, ${cluster.trend})\n`;
      prompt += `Summary: ${cluster.summary}\n`;
      prompt += `ID: ${cluster.id}\n\n`;
    }

    prompt += `
Analyze these clusters and suggest operations:

MERGE: Combine overlapping clusters with similar themes
  - Return: { type: 'merge', source_cluster_ids: ['id1', 'id2'], new_label: '...', new_summary: '...' }

SPLIT: Break large clusters (>50 signals) into sub-clusters
  - Return: { type: 'split', cluster_id: 'id', groups: [{ label: '...', summary: '...', signal_ids: [...] }] }

RENAME: Update label/summary when content has drifted
  - Return: { type: 'rename', cluster_id: 'id', new_label: '...', new_summary: '...' }

Return JSON array of operations. Return empty array if no changes needed.`;

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
      const operations: ClusterOperation[] = JSON.parse(content.text);

      return Array.isArray(operations) ? operations : [];
    } catch (error) {
      console.error('[Reclusterer] Error calling Sonnet:', error);
      return [];
    }
  }

  /**
   * Apply a merge operation
   */
  private async applyMerge(greenhouseId: string, operation: MergeOperation): Promise<void> {
    const { source_cluster_ids, new_label, new_summary } = operation;

    // Create new merged cluster
    const newCluster = await this.storage.createCluster({
      greenhouse_id: greenhouseId,
      label: new_label,
      summary: new_summary,
      signal_count: 0, // Will be updated
      trend: 'stable',
      velocity_weekly: 0,
      velocity_monthly: 0,
    });

    // Reassign all signals from source clusters to new cluster
    let totalSignals = 0;

    for (const clusterId of source_cluster_ids) {
      const signals = await this.storage.listSignals({
        greenhouse_id: greenhouseId,
        cluster_id: clusterId,
        limit: 10000,
        offset: 0,
      });

      for (const signal of signals) {
        await this.storage.updateSignal(signal.id, {
          cluster_id: newCluster.id,
        });
      }

      totalSignals += signals.length;

      // Delete old cluster
      await this.storage.deleteCluster(clusterId);
    }

    // Update new cluster signal count
    await this.storage.updateCluster(newCluster.id, {
      signal_count: totalSignals,
    });

    console.log(
      `[Reclusterer] Merged ${source_cluster_ids.length} clusters into "${new_label}" ` +
      `(${totalSignals} signals)`
    );
  }

  /**
   * Apply a split operation
   */
  private async applySplit(_greenhouseId: string, operation: SplitOperation): Promise<void> {
    const { cluster_id, groups } = operation;

    // Get the original cluster to access its greenhouse_id
    const originalCluster = await this.storage.getClusterById(cluster_id);
    if (!originalCluster) {
      throw new Error(`Cluster ${cluster_id} not found`);
    }

    // Create new clusters for each group
    for (const group of groups) {
      const newCluster = await this.storage.createCluster({
        greenhouse_id: originalCluster.greenhouse_id,
        label: group.label,
        summary: group.summary,
        signal_count: group.signal_ids.length,
        trend: 'stable',
        velocity_weekly: 0,
        velocity_monthly: 0,
      });

      // Reassign signals to new cluster
      for (const signalId of group.signal_ids) {
        await this.storage.updateSignal(signalId, {
          cluster_id: newCluster.id,
        });
      }
    }

    // Delete original cluster
    await this.storage.deleteCluster(cluster_id);

    console.log(
      `[Reclusterer] Split cluster ${cluster_id} into ${groups.length} new clusters`
    );
  }

  /**
   * Apply a rename operation
   */
  private async applyRename(operation: RenameOperation): Promise<void> {
    const { cluster_id, new_label, new_summary } = operation;

    await this.storage.updateCluster(cluster_id, {
      label: new_label,
      summary: new_summary,
    });

    console.log(`[Reclusterer] Renamed cluster ${cluster_id} to "${new_label}"`);
  }
}
