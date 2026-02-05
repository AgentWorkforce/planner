import type Database from 'better-sqlite3';
import type { Question, QuestionStatus } from '../../domain/types.js';
import { type QuestionRow, rowToQuestion } from './converters.js';

export function createQuestion(db: Database.Database, question: Question): Question {
  const stmt = db.prepare(`
    INSERT INTO questions (
      question_id, run_id, task_id, agent_id, text, options,
      blocking_level, steps_blocked, cascade_depth, can_use_default, default_value, subscribers,
      status, answer, answered_by, priority_score, created_at, answered_at
    )
    VALUES (
      @question_id, @run_id, @task_id, @agent_id, @text, @options,
      @blocking_level, @steps_blocked, @cascade_depth, @can_use_default, @default_value, @subscribers,
      @status, @answer, @answered_by, @priority_score, @created_at, @answered_at
    )
  `);
  stmt.run({
    question_id: question.question_id,
    run_id: question.run_id,
    task_id: question.task_id ?? null,
    agent_id: question.agent_id,
    text: question.text,
    options: question.options ? JSON.stringify(question.options) : null,
    blocking_level: question.blocking_level,
    steps_blocked: question.steps_blocked,
    cascade_depth: question.cascade_depth,
    can_use_default: question.can_use_default ? 1 : 0,
    default_value: question.default_value ?? null,
    subscribers: JSON.stringify(question.subscribers),
    status: question.status,
    answer: question.answer ?? null,
    answered_by: question.answered_by ?? null,
    priority_score: question.priority_score,
    created_at: question.created_at,
    answered_at: question.answered_at ?? null,
  });
  return question;
}

export function getQuestion(db: Database.Database, questionId: string): Question | null {
  const stmt = db.prepare<string, QuestionRow>(`
    SELECT question_id, run_id, task_id, agent_id, text, options,
           blocking_level, steps_blocked, cascade_depth, can_use_default, default_value, subscribers,
           status, answer, answered_by, priority_score, created_at, answered_at
    FROM questions
    WHERE question_id = ?
  `);
  const row = stmt.get(questionId);
  if (!row) return null;
  return rowToQuestion(row);
}

export function updateQuestion(db: Database.Database, questionId: string, updates: Partial<Question>): Question | null {
  const fields: string[] = [];
  const values: Record<string, unknown> = { question_id: questionId };

  if (updates.status !== undefined) {
    fields.push('status = @status');
    values.status = updates.status;
  }
  if (updates.answer !== undefined) {
    fields.push('answer = @answer');
    values.answer = updates.answer ?? null;
  }
  if (updates.answered_by !== undefined) {
    fields.push('answered_by = @answered_by');
    values.answered_by = updates.answered_by ?? null;
  }
  if (updates.answered_at !== undefined) {
    fields.push('answered_at = @answered_at');
    values.answered_at = updates.answered_at ?? null;
  }
  if (updates.priority_score !== undefined) {
    fields.push('priority_score = @priority_score');
    values.priority_score = updates.priority_score;
  }
  if (updates.steps_blocked !== undefined) {
    fields.push('steps_blocked = @steps_blocked');
    values.steps_blocked = updates.steps_blocked;
  }
  if (updates.cascade_depth !== undefined) {
    fields.push('cascade_depth = @cascade_depth');
    values.cascade_depth = updates.cascade_depth;
  }
  if (updates.subscribers !== undefined) {
    fields.push('subscribers = @subscribers');
    values.subscribers = JSON.stringify(updates.subscribers);
  }
  if (updates.can_use_default !== undefined) {
    fields.push('can_use_default = @can_use_default');
    values.can_use_default = updates.can_use_default ? 1 : 0;
  }
  if (updates.default_value !== undefined) {
    fields.push('default_value = @default_value');
    values.default_value = updates.default_value ?? null;
  }

  if (fields.length === 0) {
    return getQuestion(db, questionId);
  }

  const stmt = db.prepare(`
    UPDATE questions
    SET ${fields.join(', ')}
    WHERE question_id = @question_id
  `);
  const result = stmt.run(values);
  if (result.changes === 0) return null;
  return getQuestion(db, questionId);
}

export function answerQuestion(db: Database.Database, questionId: string, answer: string, answeredBy?: string): Question | null {
  const now = new Date().toISOString();
  return updateQuestion(db, questionId, {
    status: 'answered' as QuestionStatus,
    answer,
    answered_by: answeredBy,
    answered_at: now,
  });
}

export function dismissQuestion(db: Database.Database, questionId: string): Question | null {
  return updateQuestion(db, questionId, {
    status: 'dismissed' as QuestionStatus,
  });
}

export function listPendingByPriority(db: Database.Database, runId: string): Question[] {
  const stmt = db.prepare<string, QuestionRow>(`
    SELECT question_id, run_id, task_id, agent_id, text, options,
           blocking_level, steps_blocked, cascade_depth, can_use_default, default_value, subscribers,
           status, answer, answered_by, priority_score, created_at, answered_at
    FROM questions
    WHERE run_id = ? AND status = 'pending'
    ORDER BY priority_score DESC, created_at ASC
  `);
  const rows = stmt.all(runId);
  return rows.map((row) => rowToQuestion(row));
}

export function listQuestionsByRun(db: Database.Database, runId: string, status?: QuestionStatus): Question[] {
  let sql = `
    SELECT question_id, run_id, task_id, agent_id, text, options,
           blocking_level, steps_blocked, cascade_depth, can_use_default, default_value, subscribers,
           status, answer, answered_by, priority_score, created_at, answered_at
    FROM questions
    WHERE run_id = ?
  `;
  const params: unknown[] = [runId];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY priority_score DESC, created_at ASC';

  const stmt = db.prepare<unknown[], QuestionRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToQuestion(row));
}
