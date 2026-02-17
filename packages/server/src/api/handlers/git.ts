/**
 * Git API Handlers
 *
 * Provides git repository status and log endpoints backed by GitService.
 */

import type { Request, Response } from 'express';
import type { GitService } from '../../services/git-service.js';

/**
 * Create git handlers backed by the provided GitService instance.
 */
export function createGitHandlers(gitService: GitService) {
  return {
    /**
     * GET /api/git/status
     *
     * Returns current git working tree status (branch, files, ahead/behind).
     */
    status: async (_req: Request, res: Response): Promise<void> => {
      const result = await gitService.getStatus();
      res.json(result);
    },

    /**
     * GET /api/git/log?limit=N
     *
     * Returns recent commits. `limit` is clamped to [1, 100], defaults to 20.
     */
    log: async (req: Request, res: Response): Promise<void> => {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
      const result = await gitService.getLog(limit);
      res.json(result);
    },

    /**
     * GET /api/git/commits/:hash/files
     *
     * Returns the files changed in a specific commit, with per-file line
     * addition/deletion counts. Returns `available: false` for invalid hashes.
     */
    commitFiles: async (req: Request, res: Response): Promise<void> => {
      const hash = String(req.params['hash'] ?? '');
      const result = await gitService.getCommitFiles(hash);
      res.json(result);
    },
  };
}
