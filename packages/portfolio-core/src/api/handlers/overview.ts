import type { Request, Response, NextFunction } from 'express';
import type { SuggestionEngine } from '../../services/suggestion-engine.js';

export function createOverviewHandlers(engine: SuggestionEngine) {
  return {
    getOverview: async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const overview = await engine.getOverview();
        res.json(overview);
      } catch (err) {
        next(err);
      }
    },
  };
}
