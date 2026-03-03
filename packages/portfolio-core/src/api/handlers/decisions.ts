import type { Request, Response, NextFunction } from 'express';
import { CreateDecisionRequestSchema } from '../../domain/types.js';
import type { PortfolioStorage } from '../../storage/interface.js';
import type { PortfolioDecision } from '../../domain/types.js';

export function createDecisionHandlers(storage: PortfolioStorage) {
  return {
    listDecisions: (req: Request, res: Response, next: NextFunction) => {
      try {
        const filter: { entity_type?: string; entity_id?: string } = {};
        if (req.query.entity_type) filter.entity_type = req.query.entity_type as string;
        if (req.query.entity_id) filter.entity_id = req.query.entity_id as string;
        const decisions = storage.listDecisions(filter);
        res.json({ decisions });
      } catch (err) {
        next(err);
      }
    },

    createDecision: (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = CreateDecisionRequestSchema.parse(req.body);
        const decision: PortfolioDecision = {
          id: crypto.randomUUID(),
          ...body,
          created_at: new Date().toISOString(),
        };
        storage.createDecision(decision);
        res.status(201).json({ decision });
      } catch (err) {
        next(err);
      }
    },
  };
}
