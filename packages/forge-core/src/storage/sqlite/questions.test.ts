import { describe, it, expect, beforeEach } from 'vitest';
import { createForgeStorage } from './index.js';
import { createQuestion as createQuestionEntity } from '../../domain/types.js';
import type { ForgeStorage } from '../interface.js';
import type { Question } from '../../domain/types.js';

describe('Questions Storage', () => {
  let storage: ForgeStorage;
  let runId: string;

  beforeEach(() => {
    storage = createForgeStorage(':memory:');

    // Create a test run for foreign key constraint
    const run = storage.createRun({
      run_id: crypto.randomUUID(),
      plan_id: crypto.randomUUID(),
      plan_version: 1,
      status: 'running',
      has_pending_gate: false,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    runId = run.run_id;
  });

  it('should create a question with all fields', () => {
    const question = createQuestionEntity(
      runId,
      'agent-123',
      'What authentication method should we use?',
      'hard_block',
      {
        options: ['OAuth2', 'JWT', 'Session-based'],
        stepsBlocked: 5,
        cascadeDepth: 2,
        canUseDefault: false,
        subscribers: ['agent-123', 'agent-456'],
      }
    );

    const created = storage.createQuestion(question);

    expect(created.question_id).toBe(question.question_id);
    expect(created.run_id).toBe(runId);
    expect(created.agent_id).toBe('agent-123');
    expect(created.text).toBe('What authentication method should we use?');
    expect(created.options).toEqual(['OAuth2', 'JWT', 'Session-based']);
    expect(created.blocking_level).toBe('hard_block');
    expect(created.steps_blocked).toBe(5);
    expect(created.cascade_depth).toBe(2);
    expect(created.can_use_default).toBe(false);
    expect(created.subscribers).toEqual(['agent-123', 'agent-456']);
    expect(created.status).toBe('pending');
    expect(created.priority_score).toBeGreaterThan(0);
  });

  it('should get a question by ID', () => {
    const question = createQuestionEntity(
      runId,
      'agent-789',
      'Which database should we use?',
      'soft_block',
      {
        stepsBlocked: 3,
        cascadeDepth: 1,
        canUseDefault: true,
        defaultValue: 'PostgreSQL',
        subscribers: ['agent-789'],
      }
    );

    storage.createQuestion(question);
    const retrieved = storage.getQuestion(question.question_id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.question_id).toBe(question.question_id);
    expect(retrieved?.text).toBe('Which database should we use?');
    expect(retrieved?.default_value).toBe('PostgreSQL');
    expect(retrieved?.can_use_default).toBe(true);
  });

  it('should return null for non-existent question ID', () => {
    const retrieved = storage.getQuestion('non-existent-id');
    expect(retrieved).toBeNull();
  });

  it('should update question status and answer', () => {
    const question = createQuestionEntity(
      runId,
      'agent-xyz',
      'Should we add logging?',
      'preference',
      {
        options: ['Yes', 'No', 'Only errors'],
        stepsBlocked: 0,
        cascadeDepth: 0,
        canUseDefault: false,
        subscribers: ['agent-xyz'],
      }
    );

    storage.createQuestion(question);

    const now = new Date().toISOString();
    const updated = storage.updateQuestion(question.question_id, {
      status: 'answered',
      answer: 'Yes',
      answered_by: 'user-123',
      answered_at: now,
    });

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('answered');
    expect(updated?.answer).toBe('Yes');
    expect(updated?.answered_by).toBe('user-123');
    expect(updated?.answered_at).toBe(now);
  });

  it('should update subscribers array', () => {
    const question = createQuestionEntity(
      runId,
      'agent-001',
      'API versioning strategy?',
      'soft_block',
      {
        stepsBlocked: 2,
        cascadeDepth: 1,
        canUseDefault: false,
        subscribers: ['agent-001'],
      }
    );

    storage.createQuestion(question);

    const updated = storage.updateQuestion(question.question_id, {
      subscribers: ['agent-001', 'agent-002', 'agent-003'],
    });

    expect(updated?.subscribers).toEqual(['agent-001', 'agent-002', 'agent-003']);
  });

  it('should list pending questions by priority (highest first)', () => {
    // Create questions with different priority levels
    const highPriorityQuestion = createQuestionEntity(
      runId,
      'agent-high',
      'Critical security question',
      'hard_block',
      {
        stepsBlocked: 10,
        cascadeDepth: 5,
        canUseDefault: false,
        subscribers: ['agent-high'],
      }
    );

    const lowPriorityQuestion = createQuestionEntity(
      runId,
      'agent-low',
      'Minor preference question',
      'preference',
      {
        stepsBlocked: 1,
        cascadeDepth: 0,
        canUseDefault: true,
        defaultValue: 'default',
        subscribers: ['agent-low'],
      }
    );

    const mediumPriorityQuestion = createQuestionEntity(
      runId,
      'agent-med',
      'Important but not blocking',
      'soft_block',
      {
        stepsBlocked: 5,
        cascadeDepth: 2,
        canUseDefault: false,
        subscribers: ['agent-med'],
      }
    );

    storage.createQuestion(lowPriorityQuestion);
    storage.createQuestion(highPriorityQuestion);
    storage.createQuestion(mediumPriorityQuestion);

    const pending = storage.listPendingByPriority(runId);

    expect(pending).toHaveLength(3);
    // Highest priority should be first
    expect(pending[0].question_id).toBe(highPriorityQuestion.question_id);
    expect(pending[0].priority_score).toBeGreaterThan(pending[1].priority_score);
    expect(pending[1].priority_score).toBeGreaterThan(pending[2].priority_score);
    // Lowest priority should be last
    expect(pending[2].question_id).toBe(lowPriorityQuestion.question_id);
  });

  it('should not list answered questions in pending list', () => {
    const question1 = createQuestionEntity(
      runId,
      'agent-q1',
      'Question 1',
      'soft_block',
      {
        stepsBlocked: 2,
        cascadeDepth: 1,
        canUseDefault: false,
        subscribers: ['agent-q1'],
      }
    );

    const question2 = createQuestionEntity(
      runId,
      'agent-q2',
      'Question 2',
      'soft_block',
      {
        stepsBlocked: 2,
        cascadeDepth: 1,
        canUseDefault: false,
        subscribers: ['agent-q2'],
      }
    );

    storage.createQuestion(question1);
    storage.createQuestion(question2);

    // Answer the first question
    storage.answerQuestion(question1.question_id, 'Answer 1', 'user-123');

    const pending = storage.listPendingByPriority(runId);

    expect(pending).toHaveLength(1);
    expect(pending[0].question_id).toBe(question2.question_id);
  });

  it('should answer a question using answerQuestion helper', () => {
    const question = createQuestionEntity(
      runId,
      'agent-ans',
      'Use TypeScript?',
      'hard_block',
      {
        options: ['Yes', 'No'],
        stepsBlocked: 8,
        cascadeDepth: 3,
        canUseDefault: false,
        subscribers: ['agent-ans'],
      }
    );

    storage.createQuestion(question);

    const answered = storage.answerQuestion(question.question_id, 'Yes', 'user-456');

    expect(answered).not.toBeNull();
    expect(answered?.status).toBe('answered');
    expect(answered?.answer).toBe('Yes');
    expect(answered?.answered_by).toBe('user-456');
    expect(answered?.answered_at).toBeTruthy();
  });

  it('should dismiss a question', () => {
    const question = createQuestionEntity(
      runId,
      'agent-dis',
      'Dismissible question',
      'fyi',
      {
        stepsBlocked: 0,
        cascadeDepth: 0,
        canUseDefault: false,
        subscribers: ['agent-dis'],
      }
    );

    storage.createQuestion(question);

    const dismissed = storage.dismissQuestion(question.question_id);

    expect(dismissed).not.toBeNull();
    expect(dismissed?.status).toBe('dismissed');
  });

  it('should list questions by run with status filter', () => {
    const pending1 = createQuestionEntity(
      runId,
      'agent-p1',
      'Pending 1',
      'soft_block',
      {
        stepsBlocked: 1,
        cascadeDepth: 0,
        canUseDefault: false,
        subscribers: ['agent-p1'],
      }
    );

    const pending2 = createQuestionEntity(
      runId,
      'agent-p2',
      'Pending 2',
      'soft_block',
      {
        stepsBlocked: 1,
        cascadeDepth: 0,
        canUseDefault: false,
        subscribers: ['agent-p2'],
      }
    );

    storage.createQuestion(pending1);
    storage.createQuestion(pending2);
    storage.answerQuestion(pending1.question_id, 'Answer', 'user-123');

    const allQuestions = storage.listQuestionsByRun(runId);
    expect(allQuestions).toHaveLength(2);

    const pendingOnly = storage.listQuestionsByRun(runId, 'pending');
    expect(pendingOnly).toHaveLength(1);
    expect(pendingOnly[0].question_id).toBe(pending2.question_id);

    const answeredOnly = storage.listQuestionsByRun(runId, 'answered');
    expect(answeredOnly).toHaveLength(1);
    expect(answeredOnly[0].question_id).toBe(pending1.question_id);
  });

  it('should handle questions with optional task_id', () => {
    // Create a task first
    const task = storage.createTask({
      task_id: crypto.randomUUID(),
      run_id: runId,
      step_id: 'step-1',
      step_title: 'Test step',
      status: 'running',
      dependencies: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const questionWithTask = createQuestionEntity(
      runId,
      'agent-task',
      'Task-specific question',
      'soft_block',
      {
        taskId: task.task_id,
        stepsBlocked: 2,
        cascadeDepth: 1,
        canUseDefault: false,
        subscribers: ['agent-task'],
      }
    );

    const created = storage.createQuestion(questionWithTask);
    expect(created.task_id).toBe(task.task_id);

    const retrieved = storage.getQuestion(created.question_id);
    expect(retrieved?.task_id).toBe(task.task_id);
  });
});
