/**
 * QuestionManager — handles questions that agents ask during execution.
 *
 * Agents submit questions via an MCP tool. The QuestionManager persists the
 * question, emits a question:pending event so the UI can surface it, and
 * provides getAnswer() for agents polling for a response.
 *
 * This class is intentionally synchronous — better-sqlite3 is sync and no
 * pause/resume coordination is needed (agents poll getAnswer() themselves).
 */

import { EventEmitter } from 'node:events';
import type { ForgeNextStorage } from './storage/interface.js';
import type { Question } from './types.js';

// ---------------------------------------------------------------------------
// Event map
// ---------------------------------------------------------------------------

interface QuestionManagerEvents {
  'question:pending': [payload: { question: Question; runId: string }];
  'question:answered': [payload: { question: Question; runId: string }];
  'question:dismissed': [payload: { question: Question; runId: string }];
}

// ---------------------------------------------------------------------------
// QuestionManager
// ---------------------------------------------------------------------------

export class QuestionManager extends EventEmitter<QuestionManagerEvents> {
  private readonly storage: ForgeNextStorage;
  private runId: string | null = null;

  constructor(storage: ForgeNextStorage) {
    super();
    this.storage = storage;
  }

  /**
   * Set the active run ID. Must be called before any question operations
   * for a given run.
   */
  setRun(runId: string): void {
    this.runId = runId;
  }

  /**
   * Called when an agent asks a question (via MCP tool). Creates the question
   * record in storage and emits a question:pending event for UI notification.
   *
   * @throws {Error} If no active run has been set via setRun().
   */
  askQuestion(params: {
    step_id: string;
    agent_id?: string;
    question: string;
  }): Question {
    if (!this.runId) {
      throw new Error('Cannot ask a question: no active run set. Call setRun() first.');
    }

    const question: Question = {
      id: crypto.randomUUID(),
      run_id: this.runId,
      step_id: params.step_id,
      agent_id: params.agent_id ?? null,
      question: params.question,
      answer: null,
      status: 'pending',
      created_at: new Date().toISOString(),
      answered_at: null,
    };

    this.storage.createQuestion(question);

    this.emit('question:pending', { question, runId: this.runId });

    return question;
  }

  /**
   * Answer a pending question. The agent polling via getAnswer() will receive
   * the answer on its next call.
   *
   * @throws {Error} If the question is not found or is not in a pending state.
   */
  answerQuestion(questionId: string, answer: string): Question {
    const question = this.storage.getQuestion(questionId);

    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    if (question.status !== 'pending') {
      throw new Error(
        `Cannot answer question ${questionId}: question is already in '${question.status}' state`,
      );
    }

    const now = new Date().toISOString();

    this.storage.updateQuestion(questionId, {
      status: 'answered',
      answer,
      answered_at: now,
    });

    const updated: Question = {
      ...question,
      status: 'answered',
      answer,
      answered_at: now,
    };

    this.emit('question:answered', { question: updated, runId: question.run_id });

    return updated;
  }

  /**
   * Dismiss a pending question without providing an answer. Useful when the
   * question is no longer relevant or the run is being cancelled.
   *
   * @throws {Error} If the question is not found or is not in a pending state.
   */
  dismissQuestion(questionId: string): Question {
    const question = this.storage.getQuestion(questionId);

    if (!question) {
      throw new Error(`Question not found: ${questionId}`);
    }

    if (question.status !== 'pending') {
      throw new Error(
        `Cannot dismiss question ${questionId}: question is already in '${question.status}' state`,
      );
    }

    const now = new Date().toISOString();

    this.storage.updateQuestion(questionId, {
      status: 'dismissed',
      answered_at: now,
    });

    const updated: Question = {
      ...question,
      status: 'dismissed',
      answered_at: now,
    };

    this.emit('question:dismissed', { question: updated, runId: question.run_id });

    return updated;
  }

  /**
   * Poll for an answer to a specific question.
   * Used by agents waiting for a human response.
   *
   * Returns the answer string if the question has been answered,
   * or null if it is still pending or has been dismissed.
   */
  getAnswer(questionId: string): string | null {
    const question = this.storage.getQuestion(questionId);

    if (!question || question.status !== 'answered') {
      return null;
    }

    return question.answer;
  }

  /**
   * Reset for a new run. Clears the active run ID.
   * Call this between runs to avoid stale state.
   */
  reset(): void {
    this.runId = null;
  }
}
