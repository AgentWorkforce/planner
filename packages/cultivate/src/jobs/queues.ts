/**
 * BullMQ queue creation and configuration
 */

import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { CultivateQueues } from '../types.js';
import { CultivateStartupError } from '../errors.js';

/**
 * Create all Cultivate BullMQ queues with specific configurations
 *
 * Queues:
 * - poll-sources: Polls external sources for new events (concurrency 3, retry 3)
 * - process-signal: Runs full pipeline on signals (concurrency 5, retry 2)
 * - ingest-document: Chunks documents into signals (concurrency 2, retry 1)
 * - recluster: Weekly cluster review (Sun 03:00 UTC)
 * - decay: Daily signal decay (04:00 UTC)
 * - trend-detect: Hourly trend detection
 */
export async function createQueues(redis: Redis): Promise<CultivateQueues> {
  try {
    const connection = {
      host: redis.options.host,
      port: redis.options.port,
      password: redis.options.password,
      db: redis.options.db,
    };

    // Create queues with specific configurations
    const pollSources = new Queue('cultivate:poll-sources', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    const processSignal = new Queue('cultivate:process-signal', {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    const ingestDocument = new Queue('cultivate:ingest-document', {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 50,
        removeOnFail: 500,
      },
    });

    const recluster = new Queue('cultivate:recluster', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
      },
    });

    const decay = new Queue('cultivate:decay', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 50,
      },
    });

    const trendDetect = new Queue('cultivate:trend-detect', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 24,
        removeOnFail: 100,
      },
    });

    return {
      pollSources,
      processSignal,
      ingestDocument,
      recluster,
      decay,
      trendDetect,
    };
  } catch (error) {
    throw new CultivateStartupError(
      'QUEUE_INIT_FAILED',
      'Failed to create BullMQ queues',
      error
    );
  }
}
