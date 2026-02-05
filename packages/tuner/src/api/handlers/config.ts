/**
 * Config API Handlers
 *
 * Endpoints for Forge and Planner to read configuration.
 */

import type { Request, Response } from 'express';
import type { TunerServices } from '../../services/factory.js';

/**
 * Create config API handlers.
 */
export function createConfigHandlers(services: TunerServices) {
  return {
    /**
     * GET /api/tuner/config/forge
     * Returns ForgeExecutionConfig for Forge to consume.
     */
    getForgeConfig: (_req: Request, res: Response) => {
      try {
        const config = services.config.getCurrentForgeConfig();
        res.json(config);
      } catch (error) {
        console.error('[Tuner API] Error getting forge config:', error);
        res.status(500).json({ error: 'Failed to get forge config' });
      }
    },

    /**
     * GET /api/tuner/config/planner
     * Returns PlannerConfig for Planner to consume.
     */
    getPlannerConfig: (_req: Request, res: Response) => {
      try {
        const config = services.config.getCurrentPlannerConfig();
        res.json(config);
      } catch (error) {
        console.error('[Tuner API] Error getting planner config:', error);
        res.status(500).json({ error: 'Failed to get planner config' });
      }
    },

    /**
     * GET /api/tuner/config/ideation
     * Returns IdeationConfig for Ideation to consume.
     */
    getIdeationConfig: (_req: Request, res: Response) => {
      try {
        const config = services.config.getCurrentIdeationConfig();
        res.json(config);
      } catch (error) {
        console.error('[Tuner API] Error getting ideation config:', error);
        res.status(500).json({ error: 'Failed to get ideation config' });
      }
    },

    /**
     * GET /api/tuner/config/version
     * Returns current config version numbers.
     */
    getConfigVersion: (_req: Request, res: Response) => {
      try {
        const latest = services.config.getLatestConfig();

        if (!latest) {
          // Generate initial config
          const forgeConfig = services.config.generateForgeConfig();
          const plannerConfig = services.config.generatePlannerConfig();
          services.config.saveConfig(forgeConfig, plannerConfig, 'Initial config');

          res.json({
            forge_version: forgeConfig.version,
            planner_version: plannerConfig.version,
          });
          return;
        }

        res.json({
          forge_version: latest.forge_config.version,
          planner_version: latest.planner_config.version,
        });
      } catch (error) {
        console.error('[Tuner API] Error getting config version:', error);
        res.status(500).json({ error: 'Failed to get config version' });
      }
    },
  };
}
