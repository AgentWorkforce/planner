/**
 * Chat Suggestion Handlers
 *
 * Provides endpoints for applying AI suggestions to plans.
 */

import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import { notFound, badRequest } from '../middleware.js';
import {
  addStepToPlan,
  editStepInPlan,
  removeStepFromPlan,
  addCriteriaToStep,
  editCriteriaInStep,
} from '../../domain/plan-operations.js';

/**
 * Suggestion in chat response
 */
export interface ChatSuggestion {
  type: 'add_step' | 'edit_step' | 'remove_step' | 'add_criteria' | 'edit_criteria';
  description: string;
  preview: string;
  data: Record<string, unknown>;
}

/**
 * Creates suggestion route handlers with injected storage dependency.
 */
export function createSuggestionHandlers(storage: PlanStorage) {
  return {
    /**
     * POST /ai/suggestions/apply
     * Apply a suggestion from the chat.
     */
    applySuggestion: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { plan_id, version, suggestion_type, suggestion_data } = req.body;

        if (!plan_id || !version || !suggestion_type || !suggestion_data) {
          throw badRequest('plan_id, version, suggestion_type, and suggestion_data are required');
        }

        // Check if plan exists
        const plan = storage.getPlan(plan_id);
        if (!plan) {
          throw notFound('Plan');
        }

        // Check version exists
        const planVersion = storage.getVersion(plan_id, version);
        if (!planVersion) {
          throw notFound('Version');
        }

        // Apply the suggestion based on type using shared plan operations
        switch (suggestion_type) {
          case 'add_step': {
            const result = addStepToPlan(
              storage,
              plan_id,
              {
                title: suggestion_data.title as string,
                description: suggestion_data.description as string | undefined,
                scope: suggestion_data.scope as string | undefined,
                owner_role: suggestion_data.owner_role as string | undefined,
                dependencies: suggestion_data.dependencies as string[] | undefined,
              },
              version
            );

            if (!result.success) {
              if (result.code === 'VERSION_CONFLICT') {
                res.status(409).json({
                  success: false,
                  error: result.error,
                  code: result.code,
                });
                return;
              }
              throw badRequest(result.error);
            }

            res.json({
              success: true,
              version: result.version,
              step: result.data?.step,
            });
            return;
          }

          case 'edit_step': {
            const stepId = suggestion_data.step_id as string;
            if (!stepId) {
              throw badRequest('step_id is required for edit_step');
            }

            const result = editStepInPlan(
              storage,
              plan_id,
              stepId,
              {
                title: suggestion_data.title as string | undefined,
                description: suggestion_data.description as string | undefined,
                scope: suggestion_data.scope as string | undefined,
                owner_role: suggestion_data.owner_role as string | undefined,
              },
              version
            );

            if (!result.success) {
              if (result.code === 'VERSION_CONFLICT') {
                res.status(409).json({
                  success: false,
                  error: result.error,
                  code: result.code,
                });
                return;
              }
              throw badRequest(result.error);
            }

            res.json({
              success: true,
              version: result.version,
              step: result.data?.step,
            });
            return;
          }

          case 'remove_step': {
            const stepId = suggestion_data.step_id as string;
            if (!stepId) {
              throw badRequest('step_id is required for remove_step');
            }

            const result = removeStepFromPlan(storage, plan_id, stepId, version);

            if (!result.success) {
              if (result.code === 'VERSION_CONFLICT') {
                res.status(409).json({
                  success: false,
                  error: result.error,
                  code: result.code,
                });
                return;
              }
              throw badRequest(result.error);
            }

            res.json({
              success: true,
              version: result.version,
              removed: true,
              step_id: stepId,
            });
            return;
          }

          case 'add_criteria': {
            const stepId = suggestion_data.step_id as string;
            if (!stepId) {
              throw badRequest('step_id is required for add_criteria');
            }

            const result = addCriteriaToStep(
              storage,
              plan_id,
              stepId,
              {
                description: suggestion_data.description as string,
                type: suggestion_data.type as string | undefined,
              },
              version
            );

            if (!result.success) {
              if (result.code === 'VERSION_CONFLICT') {
                res.status(409).json({
                  success: false,
                  error: result.error,
                  code: result.code,
                });
                return;
              }
              throw badRequest(result.error);
            }

            res.json({
              success: true,
              version: result.version,
              step: result.data?.step,
              criterion: result.data?.criterion,
            });
            return;
          }

          case 'edit_criteria': {
            const stepId = suggestion_data.step_id as string;
            const criteriaId = suggestion_data.criteria_id as string;
            if (!stepId) {
              throw badRequest('step_id is required for edit_criteria');
            }
            if (!criteriaId) {
              throw badRequest('criteria_id is required for edit_criteria');
            }

            const result = editCriteriaInStep(
              storage,
              plan_id,
              stepId,
              criteriaId,
              {
                description: suggestion_data.description as string | undefined,
                type: suggestion_data.type as string | undefined,
              },
              version
            );

            if (!result.success) {
              if (result.code === 'VERSION_CONFLICT') {
                res.status(409).json({
                  success: false,
                  error: result.error,
                  code: result.code,
                });
                return;
              }
              throw badRequest(result.error);
            }

            res.json({
              success: true,
              version: result.version,
              step: result.data?.step,
              criterion: result.data?.criterion,
            });
            return;
          }

          default:
            throw badRequest(`Unknown suggestion type: ${suggestion_type}`);
        }
      } catch (err) {
        next(err);
      }
    },
  };
}
