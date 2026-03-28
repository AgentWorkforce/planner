import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { SqliteStorage } from '../../storage/index.js';
import type { Question } from '../../domain/question.js';

describe('Question Handlers - Integration Tests', () => {
  let storage: SqliteStorage;
  let app: ReturnType<typeof createApp>;
  let planId: string;

  beforeEach(async () => {
    storage = new SqliteStorage(':memory:');
    app = createApp(storage);

    // Create a test plan
    const response = await request(app)
      .post('/api/plans')
      .send({ goal: 'Test plan for questions' });
    planId = response.body.plan.plan_id;
  });

  afterEach(() => {
    storage.close();
  });

  describe('POST /api/plans/:id/questions', () => {
    it('should create a question', async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'test-agent',
          agent_role: 'Tester',
          text: 'What testing framework should we use?',
          blocking_level: 'hard_block',
        })
        .expect(201);

      expect(response.body.question).toBeDefined();
      expect(response.body.question.text).toBe('What testing framework should we use?');
      expect(response.body.question.agent_id).toBe('test-agent');
      expect(response.body.question.status).toBe('pending');
    });

    it('should return 400 for missing required fields', async () => {
      await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'test-agent',
          // Missing agent_role, text, blocking_level
        })
        .expect(400);
    });

    it('should detect duplicate questions', async () => {
      // Create first question
      await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'test-agent',
          agent_role: 'Tester',
          text: 'What testing framework?',
          blocking_level: 'hard_block',
        })
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'test-agent',
          agent_role: 'Tester',
          text: 'What testing framework?',
          blocking_level: 'hard_block',
        })
        .expect(200);

      expect(response.body.duplicate).toBe(true);
      expect(response.body.existing_question).toBeDefined();
    });
  });

  describe('GET /api/plans/:id/questions', () => {
    it('should return empty array when no questions', async () => {
      const response = await request(app)
        .get(`/api/plans/${planId}/questions`)
        .expect(200);

      expect(response.body.questions).toEqual([]);
    });

    it('should return all questions for a plan', async () => {
      // Create two questions
      await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'agent-1',
          agent_role: 'Tester',
          text: 'Question 1',
          blocking_level: 'hard_block',
        });

      await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'agent-2',
          agent_role: 'Architect',
          text: 'Question 2',
          blocking_level: 'fyi',
        });

      const response = await request(app)
        .get(`/api/plans/${planId}/questions`)
        .expect(200);

      expect(response.body.questions).toHaveLength(2);
    });

    it('should filter by status', async () => {
      // Create a question
      const createResponse = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'agent-1',
          agent_role: 'Tester',
          text: 'Question 1',
          blocking_level: 'hard_block',
        });

      const questionId = createResponse.body.question.question_id;

      // Answer it
      await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/answer`)
        .send({ answer: 'Test answer' });

      // Filter by pending (should be empty)
      const pendingResponse = await request(app)
        .get(`/api/plans/${planId}/questions?status=pending`)
        .expect(200);
      expect(pendingResponse.body.questions).toHaveLength(0);

      // Filter by answered (should have 1)
      const answeredResponse = await request(app)
        .get(`/api/plans/${planId}/questions?status=answered`)
        .expect(200);
      expect(answeredResponse.body.questions).toHaveLength(1);
    });
  });

  describe('POST /api/plans/:id/questions/:questionId/answer', () => {
    it('should answer a question', async () => {
      // Create a question
      const createResponse = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'test-agent',
          agent_role: 'Tester',
          text: 'What framework?',
          blocking_level: 'hard_block',
        });

      const questionId = createResponse.body.question.question_id;

      // Answer it
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/answer`)
        .send({ answer: 'Use Vitest' })
        .expect(200);

      expect(response.body.question.status).toBe('answered');
      expect(response.body.question.answer).toBe('Use Vitest');
    });

    it('should return 404 for non-existent question', async () => {
      await request(app)
        .post(`/api/plans/${planId}/questions/non-existent/answer`)
        .send({ answer: 'Test' })
        .expect(404);
    });
  });

  describe('POST /api/plans/:id/questions/:questionId/dismiss', () => {
    it('should dismiss a question', async () => {
      // Create a question
      const createResponse = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'test-agent',
          agent_role: 'Tester',
          text: 'FYI question',
          blocking_level: 'fyi',
        });

      const questionId = createResponse.body.question.question_id;

      // Dismiss it
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/dismiss`)
        .expect(200);

      expect(response.body.question.status).toBe('dismissed');
    });
  });

  describe('POST /api/plans/:id/questions/:questionId/subscribe', () => {
    it('should subscribe to a question', async () => {
      // Create a question
      const createResponse = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'agent-1',
          agent_role: 'Tester',
          text: 'What framework?',
          blocking_level: 'hard_block',
        });

      const questionId = createResponse.body.question.question_id;

      // Subscribe another agent
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/subscribe`)
        .send({ agent_id: 'agent-2' })
        .expect(200);

      expect(response.body.question.subscribers).toContain('agent-2');
    });
  });

  describe('POST /api/plans/:id/questions/check-duplicates', () => {
    it('should find duplicate questions', async () => {
      // Create a question
      await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'test-agent',
          agent_role: 'Tester',
          text: 'What testing framework should we use?',
          blocking_level: 'hard_block',
        });

      // Check for duplicates (same agent)
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/check-duplicates`)
        .send({
          agent_id: 'test-agent',
          text: 'What testing framework',
        })
        .expect(200);

      expect(response.body.duplicates).toHaveLength(1);
    });

    it('should return empty array when no duplicates', async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/check-duplicates`)
        .send({
          agent_id: 'test-agent',
          text: 'Completely unique question',
        })
        .expect(200);

      expect(response.body.duplicates).toHaveLength(0);
    });
  });
});
