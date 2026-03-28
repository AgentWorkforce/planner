/**
 * Question handlers — surface agent clarification requests to humans.
 */

import type { Request, Response } from 'express';
import type { ForgeNextStorage } from '../storage/interface.js';
import type { QuestionManager } from '../question-manager.js';
import { AnswerQuestionRequestSchema, ListQuestionsQuerySchema } from './schemas.js';

function routeParam(req: Request, key: string): string | null {
  const v = req.params[key];
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export interface QuestionHandlerDeps {
  storage: ForgeNextStorage;
  questionManager: QuestionManager;
}

// ---------------------------------------------------------------------------
// GET /runs/:runId/questions
// ---------------------------------------------------------------------------

export function listQuestionsHandler(deps: QuestionHandlerDeps) {
  return (req: Request, res: Response): void => {
    const runId = routeParam(req, 'runId');
    if (!runId) {
      res.status(400).json({ error: 'Run ID is required' });
      return;
    }

    const run = deps.storage.getRun(runId);
    if (!run) {
      res.status(404).json({ error: `Run not found: ${runId}` });
      return;
    }

    const parseResult = ListQuestionsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(422).json({
        error: 'Invalid query parameters',
        details: parseResult.error.issues,
      });
      return;
    }

    const { status } = parseResult.data;
    const questions =
      status === 'pending'
        ? deps.storage.listPendingQuestions(runId)
        : deps.storage.listQuestionsByRun(runId).filter(q =>
            status === undefined ? true : q.status === status,
          );

    res.status(200).json({ questions });
  };
}

// ---------------------------------------------------------------------------
// POST /questions/:id/answer
// ---------------------------------------------------------------------------

export function answerQuestionHandler(deps: QuestionHandlerDeps) {
  return (req: Request, res: Response): void => {
    const questionId = routeParam(req, 'id');
    if (!questionId) {
      res.status(400).json({ error: 'Question ID is required' });
      return;
    }

    const parseResult = AnswerQuestionRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(422).json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
      return;
    }

    let question;
    try {
      question = deps.questionManager.answerQuestion(questionId, parseResult.data.answer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('not found')) {
        res.status(404).json({ error: msg });
        return;
      }

      res.status(409).json({ error: msg });
      return;
    }

    res.status(200).json({ question });
  };
}

// ---------------------------------------------------------------------------
// POST /questions/:id/dismiss
// ---------------------------------------------------------------------------

export function dismissQuestionHandler(deps: QuestionHandlerDeps) {
  return (req: Request, res: Response): void => {
    const questionId = routeParam(req, 'id');
    if (!questionId) {
      res.status(400).json({ error: 'Question ID is required' });
      return;
    }

    let question;
    try {
      question = deps.questionManager.dismissQuestion(questionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('not found')) {
        res.status(404).json({ error: msg });
        return;
      }

      res.status(409).json({ error: msg });
      return;
    }

    res.status(200).json({ question });
  };
}
