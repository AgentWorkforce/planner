/**
 * Cluster API handlers
 * Handles Cluster read operations with Signal aggregation
 */

import type { RequestHandler } from 'express';
import { notFound } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import { ListClustersQuerySchema } from '../schemas.js';
import { computeDemandScore } from '../../scoring/demand.js';

/**
 * Create Cluster handler factory
 *
 * @param storage - Cultivate storage instance
 * @returns Object with Cluster handler functions
 */
/** Threshold for classifying a signal as substantive vs shallow */
const SUBSTANTIVE_THRESHOLD = 0.6;

export function createClusterHandlers(storage: CultivateStorage) {
  /**
   * List clusters with optional greenhouse filter
   * GET /clusters?greenhouse_id=...
   *
   * Note: Clusters MUST be scoped to a greenhouse. If no greenhouse_id provided,
   * returns empty array (clusters cannot be listed globally).
   */
  const list: RequestHandler = async (req, res, next) => {
    try {
      // Parse and validate query parameters
      const query = ListClustersQuerySchema.parse(req.query);

      // If no greenhouse_id provided, return empty array
      // Clusters must be scoped to a greenhouse
      if (!query.greenhouse_id) {
        res.json({ data: [] });
        return;
      }

      // Fetch clusters for the greenhouse (already ordered by signal_count DESC from SQL)
      const clusters = await storage.listClustersByGreenhouse(query.greenhouse_id);

      res.json({ data: clusters });
    } catch (err) {
      next(err);
    }
  };

  /**
   * Get a single cluster by ID with its signals
   * GET /clusters/:id
   *
   * Returns cluster with embedded signals array (up to 100 signals)
   */
  const get: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);

      const cluster = await storage.getClusterById(id);

      if (!cluster) {
        throw notFound('Cluster');
      }

      // Fetch signals for this cluster
      const signals = await storage.listSignals({
        cluster_id: id,
        limit: 100,
        offset: 0,
      });

      // Load extractions for each signal
      const signalsWithExtractions = await Promise.all(
        signals.map(async (signal) => {
          const extraction = await storage.getExtractionBySignalId(signal.id);
          return { ...signal, extraction };
        })
      );

      // Compute signal quality distribution
      const substantiveSignals = signalsWithExtractions.filter(s => s.score >= SUBSTANTIVE_THRESHOLD);
      const shallowSignals = signalsWithExtractions.filter(s => s.score < SUBSTANTIVE_THRESHOLD);
      const avgScore = signalsWithExtractions.length > 0
        ? signalsWithExtractions.reduce((sum, s) => sum + s.score, 0) / signalsWithExtractions.length
        : 0;

      const quality = {
        depth_score: Math.round(avgScore * 100),
        substantive_count: substantiveSignals.length,
        shallow_count: shallowSignals.length,
        total: signalsWithExtractions.length,
      };

      // Batch-load author profiles for signals in this cluster
      const uniqueAuthors = [...new Set(signalsWithExtractions.map(s => s.author).filter(Boolean))] as string[];
      const authorProfiles = uniqueAuthors.length > 0
        ? await storage.getProfilesByAuthors(cluster.greenhouse_id, uniqueAuthors)
        : [];

      // Compute demand score from signals and cluster metadata
      const demand = computeDemandScore(signalsWithExtractions, cluster);

      // Compute sentiment distribution from signal extractions
      const SENTIMENT_LEVELS = ['frustrated', 'disappointed', 'neutral', 'hopeful', 'enthusiastic'] as const;
      const sentimentCounts: Record<string, number> = {};
      for (const level of SENTIMENT_LEVELS) sentimentCounts[level] = 0;

      for (const signal of signalsWithExtractions) {
        const sentiment = signal.extraction?.sentiment ?? 'neutral';
        if (sentiment in sentimentCounts) {
          sentimentCounts[sentiment]++;
        } else {
          sentimentCounts['neutral']++;
        }
      }

      const dominantSentiment = SENTIMENT_LEVELS.reduce((a, b) =>
        sentimentCounts[a] >= sentimentCounts[b] ? a : b
      );

      const sentiment_distribution = {
        ...sentimentCounts,
        dominant: dominantSentiment,
        total: signalsWithExtractions.length,
      };

      // Return cluster with embedded signals, extractions, quality, demand, sentiment, and author profiles
      res.json({
        data: {
          ...cluster,
          signals: signalsWithExtractions,
          quality,
          demand,
          sentiment_distribution,
          author_profiles: authorProfiles,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  return {
    list,
    get,
  };
}
