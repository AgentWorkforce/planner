/**
 * Dead-letter queue management handlers
 */

import type { RequestHandler } from 'express';
import type { Queue } from 'bullmq';
import { notFound } from '@plannr/errors';

/**
 * Create dead-letter handlers with queue dependency injection
 */
export function createDeadLetterHandlers(processSignalQueue: Queue) {
  /**
   * GET /dead-letter
   * List failed jobs from the dead-letter queue
   */
  const list: RequestHandler = async (_req, res, next) => {
    try {
      const failedJobs = await processSignalQueue.getFailed(0, 100);

      const jobs = failedJobs.map((job) => ({
        id: job.id,
        data: job.data,
        failedReason: job.failedReason,
        timestamp: job.timestamp,
      }));

      res.json({ data: jobs });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /dead-letter/:id/replay
   * Retry a specific failed job
   */
  const replay: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const job = await processSignalQueue.getJob(id);

      if (!job) {
        throw notFound('Dead-letter job');
      }

      await job.retry();

      res.json({ data: { id, status: 'retried' } });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /dead-letter/replay-all
   * Retry all failed jobs
   */
  const replayAll: RequestHandler = async (_req, res, next) => {
    try {
      const failedJobs = await processSignalQueue.getFailed(0, 100);

      let replayed = 0;
      for (const job of failedJobs) {
        await job.retry();
        replayed++;
      }

      res.json({ data: { replayed } });
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /dead-letter/:id
   * Remove a failed job from the dead-letter queue
   */
  const remove: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const job = await processSignalQueue.getJob(id);

      if (!job) {
        throw notFound('Dead-letter job');
      }

      await job.remove();

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  return {
    list,
    replay,
    replayAll,
    remove,
  };
}
