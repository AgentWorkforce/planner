/**
 * Insights API Handlers
 *
 * Endpoints for Portfolio/CLI to read insights and manage drift alerts.
 */

import type { Request, Response } from 'express';
import type { TunerServices } from '../../services/factory.js';

/**
 * Create insights API handlers.
 */
export function createInsightsHandlers(services: TunerServices) {
  return {
    /**
     * GET /api/tuner/insights/summary
     * Returns aggregate insights summary.
     */
    getSummary: (_req: Request, res: Response) => {
      try {
        const summary = services.storage.getInsightsSummary();
        res.json(summary);
      } catch (error) {
        console.error('[Tuner API] Error getting insights summary:', error);
        res.status(500).json({ error: 'Failed to get insights summary' });
      }
    },

    /**
     * GET /api/tuner/insights/drift
     * Returns drift alerts with optional filtering.
     * Query params: severity (warning|critical), acknowledged (true|false), limit
     */
    getDriftAlerts: (req: Request, res: Response) => {
      try {
        const { severity, acknowledged, limit } = req.query;

        const filter: {
          severity?: 'warning' | 'critical';
          acknowledged?: boolean;
          limit?: number;
        } = {};

        if (severity === 'warning' || severity === 'critical') {
          filter.severity = severity;
        }

        if (acknowledged === 'true') {
          filter.acknowledged = true;
        } else if (acknowledged === 'false') {
          filter.acknowledged = false;
        }

        if (limit && !isNaN(Number(limit))) {
          filter.limit = Number(limit);
        }

        const alerts = services.drift.getAlerts(filter);
        res.json(alerts);
      } catch (error) {
        console.error('[Tuner API] Error getting drift alerts:', error);
        res.status(500).json({ error: 'Failed to get drift alerts' });
      }
    },

    /**
     * GET /api/tuner/insights/model-performance
     * Returns model baselines for performance analysis.
     */
    getModelPerformance: (_req: Request, res: Response) => {
      try {
        const baselines = services.selector.getModelBaselines();
        res.json(baselines);
      } catch (error) {
        console.error('[Tuner API] Error getting model performance:', error);
        res.status(500).json({ error: 'Failed to get model performance' });
      }
    },

    /**
     * POST /api/tuner/insights/drift/:id/acknowledge
     * Acknowledges a drift alert.
     */
    acknowledgeDriftAlert: (req: Request, res: Response) => {
      try {
        const id = req.params.id as string;
        const { acknowledged_by } = req.body;

        if (!acknowledged_by || typeof acknowledged_by !== 'string') {
          res.status(400).json({ error: 'acknowledged_by is required' });
          return;
        }

        const success = services.drift.acknowledgeAlert(id, acknowledged_by);

        if (success) {
          res.json({ success: true });
        } else {
          res.status(404).json({ error: 'Alert not found or already acknowledged' });
        }
      } catch (error) {
        console.error('[Tuner API] Error acknowledging drift alert:', error);
        res.status(500).json({ error: 'Failed to acknowledge drift alert' });
      }
    },

    /**
     * GET /api/tuner/insights/baselines
     * Returns task baselines for debugging.
     */
    getTaskBaselines: (_req: Request, res: Response) => {
      try {
        const baselines = services.baseline.listBaselines();
        res.json(baselines);
      } catch (error) {
        console.error('[Tuner API] Error getting task baselines:', error);
        res.status(500).json({ error: 'Failed to get task baselines' });
      }
    },
  };
}
