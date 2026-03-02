/**
 * ForgeNextStorage interface.
 *
 * Synchronous contract (better-sqlite3 is sync). Each method operates on a
 * single entity type. There is intentionally no transaction API here — callers
 * that need atomicity can use the SQLite implementation directly.
 */

import type { ForgeNextEvent, ForgeNextRun, Gate, Question } from '../types.js';

export interface ForgeNextStorage {
  // ---------------------------------------------------------------------------
  // Runs
  // ---------------------------------------------------------------------------

  /** Persist a new run record and return it. */
  createRun(run: ForgeNextRun): ForgeNextRun;

  /** Return the run by id, or null if not found. */
  getRun(id: string): ForgeNextRun | null;

  /** Apply a partial patch to an existing run. Unknown keys are ignored. */
  updateRun(id: string, patch: Partial<ForgeNextRun>): void;

  /** Return up to `limit` runs ordered by created_at descending. */
  listRuns(limit?: number): ForgeNextRun[];

  // ---------------------------------------------------------------------------
  // Gates
  // ---------------------------------------------------------------------------

  /** Persist a new gate record and return it. */
  createGate(gate: Gate): Gate;

  /** Return the gate by id, or null if not found. */
  getGate(id: string): Gate | null;

  /** Apply a partial patch to an existing gate. */
  updateGate(id: string, patch: Partial<Gate>): void;

  /** Return all gates for a run, ordered by created_at ascending. */
  listGatesByRun(runId: string): Gate[];

  /** Return only pending gates for a run. */
  listPendingGates(runId: string): Gate[];

  // ---------------------------------------------------------------------------
  // Questions
  // ---------------------------------------------------------------------------

  /** Persist a new question record and return it. */
  createQuestion(question: Question): Question;

  /** Return the question by id, or null if not found. */
  getQuestion(id: string): Question | null;

  /** Apply a partial patch to an existing question. */
  updateQuestion(id: string, patch: Partial<Question>): void;

  /** Return all questions for a run, ordered by created_at ascending. */
  listQuestionsByRun(runId: string): Question[];

  /** Return only pending questions for a run. */
  listPendingQuestions(runId: string): Question[];

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /** Append an event to the log. The `id` field is assigned by the database. */
  appendEvent(event: Omit<ForgeNextEvent, 'id'>): void;

  /**
   * Return events for a run ordered by id ascending.
   * If `since` is provided, return only events with created_at strictly after that timestamp.
   */
  listEventsByRun(runId: string, since?: string): ForgeNextEvent[];

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Close the underlying database connection. */
  close(): void;
}
