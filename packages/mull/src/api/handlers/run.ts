import type { Request, Response } from 'express';
import type { MullAdapter, MullConfig } from '../../domain/types.js';
import { TriggerRunRequestSchema } from '../schemas.js';
import { mull } from '../../mull.js';
import { mullAll } from '../../mull-all.js';

export interface MullHandlerDeps {
  adapters: MullAdapter[];
  memoryDir: string;
  config?: Partial<MullConfig>;
}

export function createRunHandler(deps: MullHandlerDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Validate request body
      const parseResult = TriggerRunRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: 'Validation error',
          details: parseResult.error.errors,
        });
        return;
      }

      const { session_ref, force, dry_run } = parseResult.data;

      // Single session or batch processing
      if (session_ref) {
        // Process single session
        const result = await mull(session_ref, {
          adapters: deps.adapters,
          force,
          dryRun: dry_run,
          config: deps.config,
        });

        res.status(200).json(result);
      } else {
        // Process all sessions
        const result = await mullAll({
          adapters: deps.adapters,
          force,
          dryRun: dry_run,
          config: deps.config,
        });

        res.status(200).json(result);
      }
    } catch (err) {
      console.error('[mull:run] Error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({
        error: 'Failed to process mull run',
        details: message,
      });
    }
  };
}
