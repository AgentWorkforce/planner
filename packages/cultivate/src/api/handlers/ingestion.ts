/**
 * Ingestion job handlers
 */

import type { RequestHandler } from 'express';
import type { Queue } from 'bullmq';
import { notFound } from '@plannr/errors';
import type { CultivateStorage } from '../../storage/interface.js';
import {
  CreateIngestionJobSchema,
  type CreateIngestionJobRequest,
} from '../schemas.js';

/**
 * Create ingestion handlers with storage and queue dependency injection
 */
export function createIngestionHandlers(
  storage: CultivateStorage,
  ingestDocumentQueue: Queue
) {
  /**
   * POST /ingestion
   * Create a new ingestion job and enqueue it for processing
   */
  const create: RequestHandler = async (req, res, next) => {
    try {
      const input: CreateIngestionJobRequest = CreateIngestionJobSchema.parse(req.body);

      // Create job in storage
      const job = await storage.createIngestionJob({
        filename: input.filename,
        greenhouse_id: input.greenhouse_id,
        total_chunks: input.total_chunks,
      });

      // Enqueue for processing
      await ingestDocumentQueue.add('ingest-document', {
        job_id: job.id,
        filename: input.filename,
        greenhouse_id: input.greenhouse_id,
        total_chunks: input.total_chunks,
      });

      res.status(201).json({ data: job });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /ingestion/:id
   * Get ingestion job status by ID
   */
  const status: RequestHandler = async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const job = await storage.getIngestionJobById(id);

      if (!job) {
        throw notFound('Ingestion job');
      }

      res.json({ data: job });
    } catch (err) {
      next(err);
    }
  };

  return {
    create,
    status,
  };
}
