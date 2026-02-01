import type { Request, Response, NextFunction } from 'express';
import type { PlanStorage } from '../../storage/interface.js';
import type { QuestionBlockingLevel, QuestionStatus } from '../../domain/question.js';
import { createQuestion as createQuestionEntity } from '../../domain/question.js';
import { emitQuestionEvent } from '../../events/question-events.js';
import { notFound, badRequest } from '../middleware.js';

interface PlanParams {
  id: string;
}

interface QuestionParams extends PlanParams {
  questionId: string;
}

interface CreateQuestionBody {
  agent_id: string;
  agent_role: string;
  text: string;
  context?: string;
  options?: string[];
  blocking_level: QuestionBlockingLevel;
  steps_blocked?: number;
  can_use_default?: boolean;
  default_value?: string;
}

interface AnswerQuestionBody {
  answer: string;
}

interface SubscribeBody {
  agent_id: string;
}

interface CheckDuplicatesBody {
  agent_id: string;
  text: string;
}

/**
 * Creates question route handlers with injected storage dependency.
 * Standalone version - no relay integration.
 */
export function createQuestionHandlers(storage: PlanStorage) {
  return {
    /**
     * POST /plans/:id/questions
     * Create a new question for a plan.
     */
    create: (req: Request<PlanParams, unknown, CreateQuestionBody>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const body = req.body;

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        // Validate required fields
        if (!body.agent_id || !body.agent_role || !body.text || !body.blocking_level) {
          throw badRequest('Missing required fields: agent_id, agent_role, text, blocking_level');
        }

        // Check for duplicate questions (same agent, similar text)
        const textPrefix = body.text.substring(0, 50);
        const duplicates = storage.findDuplicateQuestions(id, body.agent_id, textPrefix);

        if (duplicates.length > 0) {
          // Return existing question for subscription instead of creating duplicate
          res.status(200).json({
            duplicate: true,
            existing_question: duplicates[0],
            message: 'Similar question already exists. Consider subscribing to the existing question.',
          });
          return;
        }

        const question = createQuestionEntity({
          plan_id: id,
          agent_id: body.agent_id,
          agent_role: body.agent_role,
          text: body.text,
          context: body.context,
          options: body.options,
          blocking_level: body.blocking_level,
          steps_blocked: body.steps_blocked,
          can_use_default: body.can_use_default,
          default_value: body.default_value,
        });

        const created = storage.createQuestion(question);

        // Emit SSE event for real-time updates
        emitQuestionEvent(id, created.question_id, 'question_added', created);

        res.status(201).json({ question: created });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/questions
     * List questions for a plan. Optionally filter by status.
     * Without status filter, returns pending questions sorted by priority.
     */
    list: (req: Request<PlanParams>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const status = req.query.status as QuestionStatus | undefined;

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        // If status filter provided, use listQuestionsByPlan
        // Otherwise, use listPendingQuestionsByPriority for sorted pending questions
        const questions = status
          ? storage.listQuestionsByPlan(id, status)
          : storage.listPendingQuestionsByPriority(id);
        res.json({ questions, total: questions.length });
      } catch (err) {
        next(err);
      }
    },

    /**
     * GET /plans/:id/questions/:questionId
     * Get a specific question.
     */
    get: (req: Request<QuestionParams>, res: Response, next: NextFunction) => {
      try {
        const { questionId } = req.params;

        const question = storage.getQuestion(questionId);
        if (!question) {
          throw notFound('Question');
        }

        res.json({ question });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/questions/:questionId/answer
     * Answer a question.
     */
    answer: (req: Request<QuestionParams, unknown, AnswerQuestionBody>, res: Response, next: NextFunction) => {
      try {
        const { questionId } = req.params;
        const { answer } = req.body;

        if (!answer) {
          throw badRequest('Missing required field: answer');
        }

        const question = storage.getQuestion(questionId);
        if (!question) {
          throw notFound('Question');
        }

        if (question.status !== 'pending') {
          throw badRequest('Question is not pending');
        }

        const updated = storage.answerQuestion(questionId, answer);
        if (!updated) {
          throw badRequest('Failed to answer question');
        }

        // Emit SSE event for real-time updates
        emitQuestionEvent(question.plan_id, questionId, 'question_answered', updated);

        res.json({ question: updated });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/questions/:questionId/dismiss
     * Dismiss a question (use default or skip).
     */
    dismiss: (req: Request<QuestionParams>, res: Response, next: NextFunction) => {
      try {
        const { questionId } = req.params;

        const question = storage.getQuestion(questionId);
        if (!question) {
          throw notFound('Question');
        }

        if (question.status !== 'pending') {
          throw badRequest('Question is not pending');
        }

        const updated = storage.dismissQuestion(questionId);
        if (!updated) {
          throw badRequest('Failed to dismiss question');
        }

        // Emit SSE event for real-time updates
        emitQuestionEvent(question.plan_id, questionId, 'question_dismissed', updated);

        res.json({ success: true, question: updated });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/questions/:questionId/subscribe
     * Subscribe an agent to a question's answer.
     */
    subscribe: (req: Request<QuestionParams, unknown, SubscribeBody>, res: Response, next: NextFunction) => {
      try {
        const { questionId } = req.params;
        const { agent_id } = req.body;

        if (!agent_id) {
          throw badRequest('Missing required field: agent_id');
        }

        const question = storage.getQuestion(questionId);
        if (!question) {
          throw notFound('Question');
        }

        if (question.status !== 'pending') {
          throw badRequest('Question is not pending');
        }

        const updated = storage.subscribeToQuestion(questionId, agent_id);
        if (!updated) {
          throw badRequest('Failed to subscribe to question');
        }

        // Emit SSE event for real-time updates
        emitQuestionEvent(question.plan_id, questionId, 'question_subscribed', updated);

        res.json({ question: updated });
      } catch (err) {
        next(err);
      }
    },

    /**
     * POST /plans/:id/questions/check-duplicates
     * Check for existing similar questions (for deduplication UI).
     */
    checkDuplicates: (req: Request<PlanParams, unknown, CheckDuplicatesBody>, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { agent_id, text } = req.body;

        if (!agent_id || !text) {
          throw badRequest('Missing required fields: agent_id, text');
        }

        const plan = storage.getPlan(id);
        if (!plan) {
          throw notFound('Plan');
        }

        const textPrefix = text.substring(0, 50);
        const duplicates = storage.findDuplicateQuestions(id, agent_id, textPrefix);

        res.json({ duplicates });
      } catch (err) {
        next(err);
      }
    },
  };
}
