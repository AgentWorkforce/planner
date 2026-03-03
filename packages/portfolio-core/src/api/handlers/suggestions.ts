import type { Request, Response, NextFunction } from 'express';
import type { SuggestionEngine } from '../../services/suggestion-engine.js';

export function createSuggestionHandlers(engine: SuggestionEngine) {
  return {
    getSuggestions: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
        const suggestions = await engine.getSuggestions(limit);
        res.json({ suggestions });
      } catch (err) {
        next(err);
      }
    },
  };
}
