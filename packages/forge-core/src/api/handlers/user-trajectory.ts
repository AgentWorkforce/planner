import type { Request, Response } from 'express';
import type { UserTrajectoryService } from '../../services/user-trajectory-service.js';
import type { UserTrajectoryScope } from '../../domain/user-trajectory.js';

// ============================================
// Request Body Types
// ============================================

interface RecordDecisionBody {
  user_id: string;
  scope: UserTrajectoryScope;
  question_text: string;
  selected_option: string;
  reasoning?: string;
  run_id?: string;
  task_id?: string;
  project_id?: string;
  category?: string;
}

interface OverridePreferenceBody {
  value: string;
  reasoning?: string;
}

interface GetPreferenceQuery {
  user_id: string;
  run_id?: string;
  project_id?: string;
  confidence_threshold?: string;
}

interface FindSimilarQuery {
  user_id: string;
  question_text: string;
  scope?: UserTrajectoryScope;
  threshold?: string;
  limit?: string;
}

interface ListPreferencesQuery {
  user_id: string;
  scope?: UserTrajectoryScope;
  project_id?: string;
  run_id?: string;
}

interface ListHistoryQuery {
  user_id: string;
  scope?: UserTrajectoryScope;
  project_id?: string;
  run_id?: string;
}

// ============================================
// Handler Factory
// ============================================

/**
 * Creates handlers for user trajectory API endpoints.
 */
export function createUserTrajectoryHandlers(service: UserTrajectoryService) {
  return {
    /**
     * POST /user-trajectory/decisions
     * Records a user decision when answering a question.
     */
    recordDecision: (req: Request, res: Response) => {
      try {
        const body = req.body as RecordDecisionBody;

        // Validate required fields
        if (!body.user_id || !body.scope || !body.question_text || !body.selected_option) {
          res.status(400).json({
            error: 'Missing required fields: user_id, scope, question_text, selected_option',
          });
          return;
        }

        // Validate scope
        if (!['global', 'project', 'run'].includes(body.scope)) {
          res.status(400).json({
            error: "Invalid scope. Must be 'global', 'project', or 'run'",
          });
          return;
        }

        const event = service.recordUserDecision({
          userId: body.user_id,
          scope: body.scope,
          questionText: body.question_text,
          selectedOption: body.selected_option,
          reasoning: body.reasoning,
          runId: body.run_id,
          taskId: body.task_id,
          projectId: body.project_id,
          category: body.category,
        });

        res.status(201).json(event);
      } catch (err) {
        console.error('[UserTrajectory] Error recording decision:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    /**
     * GET /user-trajectory/preferences/:category
     * Gets a preference by category with scope priority (run > project > global).
     */
    getPreference: (req: Request, res: Response) => {
      try {
        const { category } = req.params as { category: string };
        const query = req.query as unknown as GetPreferenceQuery;

        if (!query.user_id) {
          res.status(400).json({ error: 'Missing required query parameter: user_id' });
          return;
        }

        if (!category) {
          res.status(400).json({ error: 'Missing required path parameter: category' });
          return;
        }

        const preference = service.getUserPreference({
          userId: query.user_id,
          category,
          runId: query.run_id,
          projectId: query.project_id,
          confidenceThreshold: query.confidence_threshold
            ? parseFloat(query.confidence_threshold)
            : undefined,
        });

        if (!preference) {
          res.status(404).json({ error: 'No preference found above confidence threshold' });
          return;
        }

        res.json(preference);
      } catch (err) {
        console.error('[UserTrajectory] Error getting preference:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    /**
     * PUT /user-trajectory/preferences/:category
     * Overrides a preference with a user-specified value.
     */
    overridePreference: (req: Request, res: Response) => {
      try {
        const { category } = req.params as { category: string };
        const query = req.query as unknown as {
          user_id: string;
          scope: UserTrajectoryScope;
          project_id?: string;
          run_id?: string;
        };
        const body = req.body as OverridePreferenceBody;

        // Validate required fields
        if (!query.user_id) {
          res.status(400).json({ error: 'Missing required query parameter: user_id' });
          return;
        }

        if (!query.scope) {
          res.status(400).json({ error: 'Missing required query parameter: scope' });
          return;
        }

        if (!category) {
          res.status(400).json({ error: 'Missing required path parameter: category' });
          return;
        }

        if (!body.value) {
          res.status(400).json({ error: 'Missing required body field: value' });
          return;
        }

        // Validate scope
        if (!['global', 'project', 'run'].includes(query.scope)) {
          res.status(400).json({
            error: "Invalid scope. Must be 'global', 'project', or 'run'",
          });
          return;
        }

        const preference = service.overridePreference({
          userId: query.user_id,
          scope: query.scope,
          category,
          value: body.value,
          projectId: query.project_id,
          runId: query.run_id,
          reasoning: body.reasoning,
        });

        res.json(preference);
      } catch (err) {
        console.error('[UserTrajectory] Error overriding preference:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    /**
     * DELETE /user-trajectory/preferences/:preferenceId
     * Deletes a preference.
     */
    deletePreference: (req: Request, res: Response) => {
      try {
        const { preferenceId } = req.params as { preferenceId: string };

        if (!preferenceId) {
          res.status(400).json({ error: 'Missing required path parameter: preferenceId' });
          return;
        }

        const deleted = service.deletePreference(preferenceId);

        if (!deleted) {
          res.status(404).json({ error: 'Preference not found' });
          return;
        }

        res.status(204).send();
      } catch (err) {
        console.error('[UserTrajectory] Error deleting preference:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    /**
     * GET /user-trajectory/preferences
     * Lists all preferences for a user.
     */
    listPreferences: (req: Request, res: Response) => {
      try {
        const query = req.query as unknown as ListPreferencesQuery;

        if (!query.user_id) {
          res.status(400).json({ error: 'Missing required query parameter: user_id' });
          return;
        }

        const preferences = service.listPreferences(
          query.user_id,
          query.scope,
          query.project_id,
          query.run_id
        );

        res.json({ preferences });
      } catch (err) {
        console.error('[UserTrajectory] Error listing preferences:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    /**
     * GET /user-trajectory/similar
     * Finds similar questions from trajectory history.
     */
    findSimilar: (req: Request, res: Response) => {
      try {
        const query = req.query as unknown as FindSimilarQuery;

        if (!query.user_id || !query.question_text) {
          res.status(400).json({
            error: 'Missing required query parameters: user_id, question_text',
          });
          return;
        }

        const similar = service.findSimilarQuestions({
          userId: query.user_id,
          questionText: query.question_text,
          scope: query.scope,
          threshold: query.threshold ? parseFloat(query.threshold) : undefined,
          limit: query.limit ? parseInt(query.limit, 10) : undefined,
        });

        res.json({ results: similar });
      } catch (err) {
        console.error('[UserTrajectory] Error finding similar questions:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    /**
     * GET /user-trajectory/auto-answer
     * Attempts to auto-answer a question based on trajectory history.
     */
    tryAutoAnswer: (req: Request, res: Response) => {
      try {
        const query = req.query as unknown as {
          user_id: string;
          question_text: string;
          scope?: UserTrajectoryScope;
          threshold?: string;
        };

        if (!query.user_id || !query.question_text) {
          res.status(400).json({
            error: 'Missing required query parameters: user_id, question_text',
          });
          return;
        }

        const result = service.tryAutoAnswer(
          query.user_id,
          query.question_text,
          query.scope,
          query.threshold ? parseFloat(query.threshold) : undefined
        );

        if (!result) {
          res.status(404).json({ error: 'No similar question found above threshold' });
          return;
        }

        res.json(result);
      } catch (err) {
        console.error('[UserTrajectory] Error trying auto-answer:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    },

    /**
     * GET /user-trajectory/history
     * Gets the trajectory history for a user.
     */
    getHistory: (req: Request, res: Response) => {
      try {
        const query = req.query as unknown as ListHistoryQuery;

        if (!query.user_id) {
          res.status(400).json({ error: 'Missing required query parameter: user_id' });
          return;
        }

        const events = service.getUserHistory(
          query.user_id,
          query.scope,
          query.project_id,
          query.run_id
        );

        res.json({ events });
      } catch (err) {
        console.error('[UserTrajectory] Error getting history:', err);
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  };
}
