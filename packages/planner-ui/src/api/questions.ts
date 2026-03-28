/**
 * Questions API client
 *
 * Functions for fetching and managing agent questions in the queue.
 */

import type { Question, QuestionBlockingLevel } from '@/types/plan';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** Response type for questions list */
export interface QuestionsResponse {
  questions: Question[];
  total: number;
}

/** Response type for single question operations */
export interface QuestionResponse {
  question: Question;
}

/** Input for answering a question */
export interface AnswerQuestionInput {
  answer: string;
}

/** Input for creating a question (mainly for testing) */
export interface CreateQuestionInput {
  plan_id: string;
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

/** Success response */
export interface SuccessResponse {
  success: boolean;
  error?: string;
}

/**
 * Get all pending questions for a plan, sorted by priority.
 *
 * @param planId - Plan ID to get questions for
 * @returns List of pending questions sorted by priority_score DESC
 */
export async function getQuestions(planId: string): Promise<QuestionsResponse> {
  const response = await fetch(`${API_BASE}/plans/${planId}/questions`);

  if (!response.ok) {
    if (response.status === 404) {
      return { questions: [], total: 0 };
    }
    throw new Error(`Failed to fetch questions: ${response.status}`);
  }

  return response.json();
}

/**
 * Get a single question by ID.
 *
 * @param planId - Plan ID
 * @param questionId - Question ID
 * @returns The question
 */
export async function getQuestion(planId: string, questionId: string): Promise<QuestionResponse> {
  const response = await fetch(`${API_BASE}/plans/${planId}/questions/${questionId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch question: ${response.status}`);
  }

  return response.json();
}

/**
 * Create a new question (primarily for testing/agents).
 *
 * @param input - Question creation input
 * @returns The created question
 */
export async function createQuestion(input: CreateQuestionInput): Promise<QuestionResponse> {
  const response = await fetch(`${API_BASE}/plans/${input.plan_id}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Failed to create question: ${response.status}`);
  }

  return response.json();
}

/**
 * Answer a question.
 *
 * @param planId - Plan ID
 * @param questionId - Question ID to answer
 * @param input - Answer input
 * @returns The updated question
 */
export async function answerQuestion(
  planId: string,
  questionId: string,
  input: AnswerQuestionInput
): Promise<QuestionResponse> {
  const response = await fetch(
    `${API_BASE}/plans/${planId}/questions/${questionId}/answer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Failed to answer question: ${response.status}`);
  }

  return response.json();
}

/**
 * Dismiss a question (use default or skip).
 *
 * @param planId - Plan ID
 * @param questionId - Question ID to dismiss
 * @returns Success response
 */
export async function dismissQuestion(
  planId: string,
  questionId: string
): Promise<SuccessResponse> {
  const response = await fetch(
    `${API_BASE}/plans/${planId}/questions/${questionId}/dismiss`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    return { success: false, error: error.message || `Failed: ${response.status}` };
  }

  return { success: true };
}

/**
 * Subscribe to a question's answer.
 *
 * @param planId - Plan ID
 * @param questionId - Question ID to subscribe to
 * @param agentId - Agent ID subscribing
 * @returns The updated question
 */
export async function subscribeToQuestion(
  planId: string,
  questionId: string,
  agentId: string
): Promise<QuestionResponse> {
  const response = await fetch(
    `${API_BASE}/plans/${planId}/questions/${questionId}/subscribe`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `Failed to subscribe: ${response.status}`);
  }

  return response.json();
}

/**
 * Check for duplicate questions (for deduplication UI).
 *
 * @param planId - Plan ID
 * @param agentId - Agent asking the question
 * @param text - Question text to check
 * @returns Potential duplicate questions
 */
export async function checkDuplicates(
  planId: string,
  agentId: string,
  text: string
): Promise<{ duplicates: Question[] }> {
  const response = await fetch(
    `${API_BASE}/plans/${planId}/questions/check-duplicates`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, text }),
    }
  );

  if (!response.ok) {
    return { duplicates: [] };
  }

  return response.json();
}
