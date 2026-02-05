import type { Router } from 'express';
import type { QuestionService } from '../../services/question-service.js';
import type { TrajectoryCapture } from '../../services/trajectory-capture.js';
import {
  createQuestionHandler,
  listPendingQuestionsHandler,
  listQuestionHistoryHandler,
  answerQuestionHandler,
  dismissQuestionHandler,
  getQuestionHandler,
} from '../handlers/questions.js';

/**
 * Options for registering question routes.
 */
export interface RegisterQuestionRoutesOptions {
  /**
   * Optional TrajectoryCapture for SSE event streaming.
   * If provided, SSE routes will be registered.
   */
  trajectoryCapture?: TrajectoryCapture;
}

/**
 * Registers question-related routes on an Express router.
 *
 * Routes:
 * - POST /questions - Create a new question (internal use by MCP)
 * - GET /questions/pending - List pending questions sorted by priority
 * - GET /questions/history - List all questions including auto-answered
 * - GET /questions/:id - Get a single question by ID
 * - POST /questions/:id/answer - Submit an answer
 * - POST /questions/:id/dismiss - Dismiss a question
 *
 * @param router - Express router to register routes on
 * @param questionService - QuestionService instance for question operations
 * @param _options - Optional configuration (reserved for future SSE support)
 */
export function registerQuestionRoutes(
  router: Router,
  questionService: QuestionService,
  _options?: RegisterQuestionRoutesOptions
): void {
  // List endpoints (placed before :id routes to avoid conflict)
  router.get('/questions/pending', listPendingQuestionsHandler(questionService));
  router.get('/questions/history', listQuestionHistoryHandler(questionService));

  // Create a new question
  router.post('/questions', createQuestionHandler(questionService));

  // Single question operations
  router.get('/questions/:id', getQuestionHandler(questionService));
  router.post('/questions/:id/answer', answerQuestionHandler(questionService));
  router.post('/questions/:id/dismiss', dismissQuestionHandler(questionService));
}
