/**
 * Questions API for Forge UI
 *
 * Provides functions for interacting with question resources,
 * including listing pending questions, answering, and dismissing them.
 */

import { get, post } from './client';
import type {
  Question,
  PendingQuestionsResponse,
  QuestionHistoryResponse,
} from '@/types';

/**
 * List all pending questions, optionally filtered by run ID
 */
export async function listPendingQuestions(runId?: string): Promise<Question[]> {
  const params: Record<string, unknown> = {};
  if (runId) {
    params.run_id = runId;
  }
  const response = await get<PendingQuestionsResponse>('/questions/pending', params);
  return response.questions;
}

/**
 * List question history (answered, dismissed, etc.), optionally filtered by run ID
 */
export async function listQuestionHistory(runId?: string): Promise<Question[]> {
  const params: Record<string, unknown> = {};
  if (runId) {
    params.run_id = runId;
  }
  const response = await get<QuestionHistoryResponse>('/questions/history', params);
  return response.questions;
}

/**
 * Answer a single question
 */
export async function answerQuestion(questionId: string, answer: string): Promise<void> {
  await post(`/questions/${questionId}/answer`, { answer });
}

/**
 * Answer multiple questions at once (for grouped questions)
 */
export async function answerQuestionGroup(questionIds: string[], answer: string): Promise<void> {
  await post('/questions/answer-group', { question_ids: questionIds, answer });
}

/**
 * Dismiss a question (mark as no longer needing an answer)
 */
export async function dismissQuestion(questionId: string): Promise<void> {
  await post(`/questions/${questionId}/dismiss`);
}
