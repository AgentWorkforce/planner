import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { badRequest, notFound } from '@plannr/errors';
import type { MullAdapter, MullConfig, MullResult, MullAllResult } from '../../domain/types.js';
import { TriggerRunRequestSchema } from '../schemas.js';
import { mull } from '../../mull.js';
import { mullAll } from '../../mull-all.js';

export interface MullHandlerDeps {
  adapters: MullAdapter[];
  memoryDir: string;
  config?: Partial<MullConfig>;
}

// Job status tracking
export interface JobStatus {
  status: 'accepted' | 'running' | 'completed' | 'failed';
  result?: MullResult | MullAllResult;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// Module-level jobs map
const jobs = new Map<string, JobStatus>();

export function createRunHandler(deps: MullHandlerDeps) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate request body
      const parseResult = TriggerRunRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw badRequest('Validation error', parseResult.error.errors);
      }

      const { session_ref, force, dry_run } = parseResult.data;

      // Generate job ID
      const jobId = randomUUID();

      // Store job as accepted
      jobs.set(jobId, {
        status: 'accepted',
        startedAt: new Date().toISOString(),
      });

      // Fire pipeline in background
      const runPipeline = async () => {
        try {
          // Update status to running
          const job = jobs.get(jobId);
          if (job) {
            job.status = 'running';
          }

          let result: MullResult | MullAllResult;

          if (session_ref) {
            // Process single session
            result = await mull(session_ref, {
              adapters: deps.adapters,
              force,
              dryRun: dry_run,
              config: deps.config,
            });
          } else {
            // Process all sessions
            result = await mullAll({
              adapters: deps.adapters,
              force,
              dryRun: dry_run,
              config: deps.config,
            });
          }

          // Update job with result
          const finalJob = jobs.get(jobId);
          if (finalJob) {
            finalJob.status = 'completed';
            finalJob.result = result;
            finalJob.completedAt = new Date().toISOString();
          }
        } catch (err) {
          console.error(`[mull:run] Job ${jobId} failed:`, err);
          const message = err instanceof Error ? err.message : 'Unknown error';

          const failedJob = jobs.get(jobId);
          if (failedJob) {
            failedJob.status = 'failed';
            failedJob.error = message;
            failedJob.completedAt = new Date().toISOString();
          }
        }
      };

      // Start pipeline (don't await)
      runPipeline();

      // Return 202 Accepted immediately
      res.status(202).json({
        jobId,
        status: 'accepted',
      });
    } catch (err) {
      next(err);
    }
  };
}

export function createJobStatusHandler() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const rawJobId = req.params.jobId;
      const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;

      if (!jobId) {
        throw badRequest('Missing jobId parameter');
      }

      const job = jobs.get(jobId);
      if (!job) {
        throw notFound(`Job not found: ${jobId}`);
      }

      res.status(200).json({
        jobId,
        ...job,
      });
    } catch (err) {
      next(err);
    }
  };
}
