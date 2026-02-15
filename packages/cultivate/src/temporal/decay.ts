/**
 * Decay Engine - Apply exponential decay to signal scores over time
 */

import type { CultivateStorage } from '../storage/interface.js';

export class DecayEngine {
  constructor(private storage: CultivateStorage) {}

  /**
   * Apply exponential decay to all active signals in a greenhouse.
   *
   * Formula: decayed_score = original_score * (0.5 ^ (days_since_created / half_life_days))
   *
   * - Signals with linked_plan_id are exempt (user took action)
   * - Signals whose decayed score drops below decay_threshold (default 0.15) get status='decayed'
   * - Returns count of decayed signals
   */
  async applyDecay(
    greenhouseId: string,
    halfLifeDays = 90,
    decayThreshold = 0.15,
    linkedExempt = true
  ): Promise<{ updated: number; decayed: number }> {
    // Load all active signals for the greenhouse (status != 'decayed')
    const allSignals = await this.storage.listSignals({
      greenhouse_id: greenhouseId,
      limit: 10000, // Large limit to get all signals
      offset: 0,
    });

    // Filter to only active signals (not already decayed)
    const activeSignals = allSignals.filter(s => s.status !== 'decayed');

    let updatedCount = 0;
    let decayedCount = 0;

    const now = new Date();

    for (const signal of activeSignals) {
      // Skip signals with linked_plan_id if linkedExempt is true
      if (linkedExempt && signal.linked_plan_id) {
        continue;
      }

      // Calculate days since creation
      const createdAt = new Date(signal.created_at);
      const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

      // Apply exponential decay formula
      // decayed_score = original_score * (0.5 ^ (days_since_created / half_life_days))
      const decayFactor = Math.pow(0.5, daysSinceCreated / halfLifeDays);
      const newScore = signal.score * decayFactor;

      // Determine if signal should be marked as decayed
      const shouldMarkDecayed = newScore < decayThreshold;

      // Update signal
      await this.storage.updateSignal(signal.id, {
        score: newScore,
        status: shouldMarkDecayed ? 'decayed' : signal.status,
      });

      updatedCount++;

      if (shouldMarkDecayed && signal.status !== 'decayed') {
        decayedCount++;
      }
    }

    console.log(
      `[DecayEngine] Greenhouse ${greenhouseId}: updated ${updatedCount} signals, ${decayedCount} newly decayed`
    );

    return { updated: updatedCount, decayed: decayedCount };
  }
}
