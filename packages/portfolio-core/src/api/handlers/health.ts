import type { Request, Response, NextFunction } from 'express';
import type { SuggestionEngine } from '../../services/suggestion-engine.js';

export function createHealthHandlers(engine: SuggestionEngine) {
  return {
    getInitiativeHealth: async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const health = await engine.getAllInitiativeHealth();
        res.json({ health });
      } catch (err) {
        next(err);
      }
    },

    getPlanHealth: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        if (typeof id !== 'string') {
          res.status(400).json({ error: 'Invalid plan ID' });
          return;
        }
        const health = await engine.getHealthForPlan(id);
        res.json({ health });
      } catch (err) {
        next(err);
      }
    },
  };
}
