import type { Request, Response } from 'express';
import { z } from 'zod';
import type { QuestionService, PendingQuestionInfo } from '../../services/question-service.js';
import { QuestionBlockingLevelSchema, QuestionStatusSchema } from '../../domain/types.js';

// ============================================
// Request Validation Schemas
// ============================================

/**
 * Request body for creating a question.
 */
export const CreateQuestionRequestSchema = z.object({
  run_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  agent_id: z.string().min(1, 'agent_id is required'),
  text: z.string().min(1, 'text is required'),
  options: z.array(z.string()).optional(),
  blocking_level: QuestionBlockingLevelSchema,
  steps_blocked: z.number().int().min(0).optional(),
  cascade_depth: z.number().int().min(0).optional(),
  can_use_default: z.boolean().optional(),
  default_value: z.string().optional(),
  /** Disable trajectory deduplication check */
  skip_dedup: z.boolean().optional(),
});

export type CreateQuestionRequest = z.infer<typeof CreateQuestionRequestSchema>;

/**
 * Request body for answering a question.
 */
export const AnswerQuestionRequestSchema = z.object({
  answer: z.string().min(1, 'answer is required'),
  answered_by: z.string().min(1, 'answered_by is required'),
});

export type AnswerQuestionRequest = z.infer<typeof AnswerQuestionRequestSchema>;

/**
 * Request body for dismissing a question.
 */
export const DismissQuestionRequestSchema = z.object({
  dismissed_by: z.string().min(1, 'dismissed_by is required'),
  reason: z.string().optional(),
});

export type DismissQuestionRequest = z.infer<typeof DismissQuestionRequestSchema>;

/**
 * Query parameters for listing pending questions.
 */
export const ListPendingQuestionsQuerySchema = z.object({
  run_id: z.string().uuid().optional(),
});

export type ListPendingQuestionsQuery = z.infer<typeof ListPendingQuestionsQuerySchema>;

/**
 * Query parameters for listing question history.
 */
export const ListQuestionHistoryQuerySchema = z.object({
  run_id: z.string().uuid(),
  status: QuestionStatusSchema.optional(),
});

export type ListQuestionHistoryQuery = z.infer<typeof ListQuestionHistoryQuerySchema>;

// ============================================
// Response Types
// ============================================

/**
 * Response for creating a question.
 */
export interface CreateQuestionResponse {
  question_id: string;
  run_id: string;
  status: string;
  priority_score: number;
  was_subscribed: boolean;
  was_auto_answered: boolean;
  source_question_id?: string;
  answer?: string;
}

/**
 * Response for answering a question.
 */
export interface AnswerQuestionResponse {
  question_id: string;
  status: string;
  answer: string;
  answered_by: string;
  answered_at: string;
  notified_subscribers: string[];
}

/**
 * Response for dismissing a question.
 */
export interface DismissQuestionResponse {
  question_id: string;
  status: string;
}

/**
 * Response for listing pending questions.
 */
export interface PendingQuestionsResponse {
  questions: PendingQuestionInfo[];
  total: number;
}

/**
 * Response for listing question history.
 */
export interface QuestionHistoryResponse {
  questions: Array<{
    question_id: string;
    run_id: string;
    task_id?: string;
    agent_id: string;
    text: string;
    options?: string[];
    blocking_level: string;
    status: string;
    answer?: string;
    answered_by?: string;
    priority_score: number;
    agents_waiting: number;
    created_at: string;
    answered_at?: string;
  }>;
  total: number;
}

// ============================================
// Handler Factory Functions
// ============================================

/**
 * Creates a handler for POST /questions
 *
 * Creates a new question or subscribes to existing similar one.
 * May return auto-answered question if similar answer found in trajectory.
 */
export function createQuestionHandler(questionService: QuestionService) {
  return (req: Request, res: Response): void => {
    try {
      // Validate request body
      const bodyResult = CreateQuestionRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const body = bodyResult.data;

      // Ask the question (handles deduplication internally)
      const result = questionService.askQuestion(
        body.run_id,
        body.agent_id,
        body.text,
        body.blocking_level,
        {
          taskId: body.task_id,
          options: body.options,
          stepsBlocked: body.steps_blocked,
          cascadeDepth: body.cascade_depth,
          canUseDefault: body.can_use_default,
          defaultValue: body.default_value,
          checkTrajectory: !body.skip_dedup,
        }
      );

      const response: CreateQuestionResponse = {
        question_id: result.question.question_id,
        run_id: result.question.run_id,
        status: result.question.status,
        priority_score: result.question.priority_score,
        was_subscribed: result.wasSubscribed,
        was_auto_answered: result.wasAutoAnswered,
        source_question_id: result.sourceQuestionId,
        answer: result.wasAutoAnswered ? result.question.answer : undefined,
      };

      // Return 201 for new questions, 200 for subscriptions/auto-answered
      const statusCode = result.wasSubscribed || result.wasAutoAnswered ? 200 : 201;
      res.status(statusCode).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[QuestionHandler] Error creating question:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /questions/pending
 *
 * Returns list of pending questions sorted by priority.
 * If run_id is provided, filters to that run only.
 */
export function listPendingQuestionsHandler(questionService: QuestionService) {
  return (req: Request, res: Response): void => {
    try {
      // Validate query parameters
      const queryResult = ListPendingQuestionsQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const query = queryResult.data;

      if (!query.run_id) {
        // If no run_id, return error (could support listing across all runs in future)
        res.status(400).json({
          error: 'run_id query parameter is required',
        });
        return;
      }

      const questions = questionService.listPendingQuestions(query.run_id);

      const response: PendingQuestionsResponse = {
        questions,
        total: questions.length,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[QuestionHandler] Error listing pending questions:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /questions/history
 *
 * Returns all questions for a run, including auto-answered ones.
 * Provides transparency into deduplication behavior.
 */
export function listQuestionHistoryHandler(questionService: QuestionService) {
  return (req: Request, res: Response): void => {
    try {
      // Validate query parameters
      const queryResult = ListQuestionHistoryQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: queryResult.error.issues,
        });
        return;
      }

      const query = queryResult.data;
      const questions = questionService.listQuestionHistory(query.run_id, query.status);

      const response: QuestionHistoryResponse = {
        questions: questions.map((q) => ({
          question_id: q.question_id,
          run_id: q.run_id,
          task_id: q.task_id,
          agent_id: q.agent_id,
          text: q.text,
          options: q.options,
          blocking_level: q.blocking_level,
          status: q.status,
          answer: q.answer,
          answered_by: q.answered_by,
          priority_score: q.priority_score,
          agents_waiting: 1 + q.subscribers.length,
          created_at: q.created_at,
          answered_at: q.answered_at,
        })),
        total: questions.length,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error('[QuestionHandler] Error listing question history:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /questions/:id/answer
 *
 * Submits an answer to a pending question.
 * Notifies all subscribers.
 */
export function answerQuestionHandler(questionService: QuestionService) {
  return (req: Request, res: Response): void => {
    try {
      const questionId = req.params.id as string;

      if (!questionId) {
        res.status(400).json({ error: 'Question ID is required' });
        return;
      }

      // Validate request body
      const bodyResult = AnswerQuestionRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const body = bodyResult.data;

      // Answer the question
      const result = questionService.answerQuestion(
        questionId,
        body.answer,
        body.answered_by
      );

      const response: AnswerQuestionResponse = {
        question_id: result.question.question_id,
        status: result.question.status,
        answer: result.question.answer!,
        answered_by: result.question.answered_by!,
        answered_at: result.question.answered_at!,
        notified_subscribers: result.notifiedSubscribers,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Handle specific error cases
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes('already resolved')) {
        res.status(409).json({ error: error.message });
        return;
      }

      console.error('[QuestionHandler] Error answering question:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for POST /questions/:id/dismiss
 *
 * Dismisses a question without an answer.
 */
export function dismissQuestionHandler(questionService: QuestionService) {
  return (req: Request, res: Response): void => {
    try {
      const questionId = req.params.id as string;

      if (!questionId) {
        res.status(400).json({ error: 'Question ID is required' });
        return;
      }

      // Validate request body
      const bodyResult = DismissQuestionRequestSchema.safeParse(req.body);
      if (!bodyResult.success) {
        res.status(400).json({
          error: 'Invalid request body',
          details: bodyResult.error.issues,
        });
        return;
      }

      const body = bodyResult.data;

      // Dismiss the question
      const question = questionService.dismissQuestion(
        questionId,
        body.dismissed_by,
        body.reason
      );

      const response: DismissQuestionResponse = {
        question_id: question.question_id,
        status: question.status,
      };

      res.status(200).json(response);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Handle specific error cases
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes('already resolved')) {
        res.status(409).json({ error: error.message });
        return;
      }

      console.error('[QuestionHandler] Error dismissing question:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Creates a handler for GET /questions/:id
 *
 * Gets a single question by ID.
 */
export function getQuestionHandler(questionService: QuestionService) {
  return (req: Request, res: Response): void => {
    try {
      const questionId = req.params.id as string;

      if (!questionId) {
        res.status(400).json({ error: 'Question ID is required' });
        return;
      }

      const question = questionService.getQuestion(questionId);

      if (!question) {
        res.status(404).json({ error: `Question not found: ${questionId}` });
        return;
      }

      res.status(200).json({
        question_id: question.question_id,
        run_id: question.run_id,
        task_id: question.task_id,
        agent_id: question.agent_id,
        text: question.text,
        options: question.options,
        blocking_level: question.blocking_level,
        steps_blocked: question.steps_blocked,
        cascade_depth: question.cascade_depth,
        can_use_default: question.can_use_default,
        default_value: question.default_value,
        subscribers: question.subscribers,
        status: question.status,
        answer: question.answer,
        answered_by: question.answered_by,
        priority_score: question.priority_score,
        agents_waiting: 1 + question.subscribers.length,
        created_at: question.created_at,
        answered_at: question.answered_at,
      });
    } catch (err) {
      console.error('[QuestionHandler] Error getting question:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// ============================================
// Export handler types
// ============================================

export type CreateQuestionHandlerFn = ReturnType<typeof createQuestionHandler>;
export type ListPendingQuestionsHandlerFn = ReturnType<typeof listPendingQuestionsHandler>;
export type ListQuestionHistoryHandlerFn = ReturnType<typeof listQuestionHistoryHandler>;
export type AnswerQuestionHandlerFn = ReturnType<typeof answerQuestionHandler>;
export type DismissQuestionHandlerFn = ReturnType<typeof dismissQuestionHandler>;
export type GetQuestionHandlerFn = ReturnType<typeof getQuestionHandler>;
