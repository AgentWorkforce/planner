import type Database from 'better-sqlite3';
import type { Question, QuestionStatus } from '../../domain/question.js';
import { calculatePriorityScore } from '../../domain/question.js';
import { rowToQuestion } from './converters.js';
import type { QuestionRow } from './converters.js';

// ============================================
// Question operations
// ============================================

export function createQuestion(db: Database.Database, question: Question): Question {
  const stmt = db.prepare(`
    INSERT INTO questions (
      question_id, plan_id, agent_id, agent_role, text, context,
      options_json, blocking_level, steps_blocked, can_use_default,
      default_value, subscribers_json, merged_from_json, status,
      answer, answered_at, priority_score, created_at, updated_at
    )
    VALUES (
      @question_id, @plan_id, @agent_id, @agent_role, @text, @context,
      @options_json, @blocking_level, @steps_blocked, @can_use_default,
      @default_value, @subscribers_json, @merged_from_json, @status,
      @answer, @answered_at, @priority_score, @created_at, @updated_at
    )
  `);
  stmt.run({
    question_id: question.question_id,
    plan_id: question.plan_id,
    agent_id: question.agent_id,
    agent_role: question.agent_role,
    text: question.text,
    context: question.context ?? null,
    options_json: question.options ? JSON.stringify(question.options) : null,
    blocking_level: question.blocking_level,
    steps_blocked: question.steps_blocked,
    can_use_default: question.can_use_default ? 1 : 0,
    default_value: question.default_value ?? null,
    subscribers_json: JSON.stringify(question.subscribers),
    merged_from_json: JSON.stringify(question.merged_from),
    status: question.status,
    answer: question.answer ?? null,
    answered_at: question.answered_at ?? null,
    priority_score: question.priority_score,
    created_at: question.created_at,
    updated_at: question.updated_at,
  });
  return question;
}

export function getQuestion(db: Database.Database, questionId: string): Question | null {
  const stmt = db.prepare<string, QuestionRow>(`
    SELECT question_id, plan_id, agent_id, agent_role, text, context,
           options_json, blocking_level, steps_blocked, can_use_default,
           default_value, subscribers_json, merged_from_json, status,
           answer, answered_at, priority_score, created_at, updated_at
    FROM questions
    WHERE question_id = ?
  `);
  const row = stmt.get(questionId);
  if (!row) return null;
  return rowToQuestion(row);
}

export function updateQuestion(
  db: Database.Database,
  questionId: string,
  updates: Partial<Question>
): Question | null {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = @updated_at'];
  const values: Record<string, unknown> = { question_id: questionId, updated_at: now };

  if (updates.text !== undefined) {
    fields.push('text = @text');
    values.text = updates.text;
  }
  if (updates.context !== undefined) {
    fields.push('context = @context');
    values.context = updates.context ?? null;
  }
  if (updates.options !== undefined) {
    fields.push('options_json = @options_json');
    values.options_json = updates.options ? JSON.stringify(updates.options) : null;
  }
  if (updates.blocking_level !== undefined) {
    fields.push('blocking_level = @blocking_level');
    values.blocking_level = updates.blocking_level;
  }
  if (updates.steps_blocked !== undefined) {
    fields.push('steps_blocked = @steps_blocked');
    values.steps_blocked = updates.steps_blocked;
  }
  if (updates.can_use_default !== undefined) {
    fields.push('can_use_default = @can_use_default');
    values.can_use_default = updates.can_use_default ? 1 : 0;
  }
  if (updates.default_value !== undefined) {
    fields.push('default_value = @default_value');
    values.default_value = updates.default_value ?? null;
  }
  if (updates.subscribers !== undefined) {
    fields.push('subscribers_json = @subscribers_json');
    values.subscribers_json = JSON.stringify(updates.subscribers);
  }
  if (updates.merged_from !== undefined) {
    fields.push('merged_from_json = @merged_from_json');
    values.merged_from_json = JSON.stringify(updates.merged_from);
  }
  if (updates.status !== undefined) {
    fields.push('status = @status');
    values.status = updates.status;
  }
  if (updates.answer !== undefined) {
    fields.push('answer = @answer');
    values.answer = updates.answer ?? null;
  }
  if (updates.answered_at !== undefined) {
    fields.push('answered_at = @answered_at');
    values.answered_at = updates.answered_at ?? null;
  }
  if (updates.priority_score !== undefined) {
    fields.push('priority_score = @priority_score');
    values.priority_score = updates.priority_score;
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

export function answerQuestion(
  db: Database.Database,
  questionId: string,
  answer: string
): Question | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE questions
    SET status = 'answered', answer = ?, answered_at = ?, updated_at = ?
    WHERE question_id = ?
  `);
  const result = stmt.run(answer, now, now, questionId);
  if (result.changes === 0) return null;
  return getQuestion(db, questionId);
}

export function dismissQuestion(db: Database.Database, questionId: string): Question | null {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE questions
    SET status = 'dismissed', updated_at = ?
    WHERE question_id = ?
  `);
  const result = stmt.run(now, questionId);
  if (result.changes === 0) return null;
  return getQuestion(db, questionId);
}

export function subscribeToQuestion(
  db: Database.Database,
  questionId: string,
  agentId: string
): Question | null {
  const question = getQuestion(db, questionId);
  if (!question) return null;

  // Don't add duplicate subscribers
  if (question.subscribers.includes(agentId)) {
    return question;
  }

  const newSubscribers = [...question.subscribers, agentId];
  const newPriorityScore = calculatePriorityScore(
    question.blocking_level,
    question.steps_blocked,
    newSubscribers.length,
    question.created_at
  );

  return updateQuestion(db, questionId, {
    subscribers: newSubscribers,
    priority_score: newPriorityScore,
  });
}

export function mergeQuestions(
  db: Database.Database,
  targetId: string,
  duplicateId: string
): Question | null {
  const target = getQuestion(db, targetId);
  const duplicate = getQuestion(db, duplicateId);
  if (!target || !duplicate) return null;

  const newMergedFrom = [...target.merged_from, duplicateId];
  const newSubscribers = target.subscribers.includes(duplicate.agent_id)
    ? target.subscribers
    : [...target.subscribers, duplicate.agent_id];

  const newPriorityScore = calculatePriorityScore(
    target.blocking_level,
    target.steps_blocked,
    newSubscribers.length,
    target.created_at
  );

  // Update target with merged data
  const updated = updateQuestion(db, targetId, {
    merged_from: newMergedFrom,
    subscribers: newSubscribers,
    priority_score: newPriorityScore,
  });

  // Mark duplicate as dismissed
  dismissQuestion(db, duplicateId);

  return updated;
}

export function listQuestionsByPlan(
  db: Database.Database,
  planId: string,
  status?: QuestionStatus
): Question[] {
  let sql = `
    SELECT question_id, plan_id, agent_id, agent_role, text, context,
           options_json, blocking_level, steps_blocked, can_use_default,
           default_value, subscribers_json, merged_from_json, status,
           answer, answered_at, priority_score, created_at, updated_at
    FROM questions
    WHERE plan_id = ?
  `;
  const params: unknown[] = [planId];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY priority_score DESC, created_at ASC`;

  const stmt = db.prepare<unknown[], QuestionRow>(sql);
  const rows = stmt.all(...params);
  return rows.map((row) => rowToQuestion(row));
}

export function listPendingQuestionsByPriority(db: Database.Database, planId: string): Question[] {
  return listQuestionsByPlan(db, planId, 'pending');
}

export function findDuplicateQuestions(
  db: Database.Database,
  planId: string,
  agentId: string,
  textPrefix: string
): Question[] {
  // Find pending questions from same agent with similar text start
  const stmt = db.prepare<[string, string, string], QuestionRow>(`
    SELECT question_id, plan_id, agent_id, agent_role, text, context,
           options_json, blocking_level, steps_blocked, can_use_default,
           default_value, subscribers_json, merged_from_json, status,
           answer, answered_at, priority_score, created_at, updated_at
    FROM questions
    WHERE plan_id = ? AND agent_id = ? AND status = 'pending'
      AND text LIKE ? || '%'
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(planId, agentId, textPrefix);
  return rows.map((row) => rowToQuestion(row));
}

export function deleteQuestion(db: Database.Database, questionId: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM questions
    WHERE question_id = ?
  `);
  const result = stmt.run(questionId);
  return result.changes > 0;
}
