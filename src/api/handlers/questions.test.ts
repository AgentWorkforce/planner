import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { SqliteStorage } from '../../storage/sqlite.js';
import type { Question } from '../../domain/question.js';

// Mock the relay client module
vi.mock('../../relay/client.js', () => ({
  sendMessage: vi.fn(() => true),
  sendChannelMessage: vi.fn(() => true),
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(() => {}),
  destroy: vi.fn(() => {}),
  isConnected: vi.fn(() => false),
  getConnectionState: vi.fn(() => 'DISCONNECTED'),
  getClient: vi.fn(() => null),
  onStateChange: vi.fn(() => () => {}),
  onMessage: vi.fn(() => () => {}),
  spawnAgent: vi.fn(async () => ({ success: false, name: '', error: 'Mocked', replyTo: '' })),
  releaseAgent: vi.fn(async () => ({ success: false, name: '', error: 'Mocked', replyTo: '' })),
  getSpawnedAgents: vi.fn(() => []),
  isAgentSpawned: vi.fn(() => false),
}));

// Import the mocked functions for assertions
import { sendChannelMessage, sendMessage } from '../../relay/client.js';

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

    // Clear mock call history
    vi.clearAllMocks();
  });

  afterEach(() => {
    storage.close();
  });

  describe('POST /api/plans/:id/questions', () => {
    it('should create a new question', async () => {
      const questionData = {
        agent_id: 'test-agent',
        agent_role: 'coder',
        text: 'Should I use TypeScript?',
        context: 'Working on a new feature',
        options: ['Yes', 'No'],
        blocking_level: 'soft_block',
        steps_blocked: 2,
        can_use_default: true,
        default_value: 'Yes',
      };

      const response = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send(questionData)
        .expect(201);

      expect(response.body.question).toBeDefined();
      expect(response.body.question.question_id).toBeDefined();
      expect(response.body.question.text).toBe(questionData.text);
      expect(response.body.question.agent_id).toBe(questionData.agent_id);
      expect(response.body.question.status).toBe('pending');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({ text: 'Incomplete question' })
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });

    it('should detect duplicate questions', async () => {
      const questionData = {
        agent_id: 'test-agent',
        agent_role: 'coder',
        text: 'Should I use TypeScript for this project?',
        blocking_level: 'soft_block',
      };

      // Create first question
      await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send(questionData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send(questionData)
        .expect(200);

      expect(response.body.duplicate).toBe(true);
      expect(response.body.existing_question).toBeDefined();
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .post('/api/plans/non-existent-id/questions')
        .send({
          agent_id: 'test-agent',
          agent_role: 'coder',
          text: 'Test question',
          blocking_level: 'soft_block',
        })
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });
  });

  describe('GET /api/plans/:id/questions', () => {
    it('should list pending questions sorted by priority', async () => {
      // Create questions with different priorities
      await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'agent-1',
          agent_role: 'coder',
          text: 'Low priority question',
          blocking_level: 'fyi',
        });

      await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'agent-2',
          agent_role: 'architect',
          text: 'High priority question',
          blocking_level: 'hard_block',
          steps_blocked: 5,
        });

      const response = await request(app)
        .get(`/api/plans/${planId}/questions`)
        .expect(200);

      expect(response.body.questions).toHaveLength(2);
      expect(response.body.total).toBe(2);
      // Higher priority should be first
      expect(response.body.questions[0].blocking_level).toBe('hard_block');
    });

    it('should return empty array when no questions exist', async () => {
      const response = await request(app)
        .get(`/api/plans/${planId}/questions`)
        .expect(200);

      expect(response.body.questions).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .get('/api/plans/non-existent-id/questions')
        .expect(404);
    });
  });

  describe('POST /api/plans/:id/questions/:questionId/answer', () => {
    let questionId: string;

    beforeEach(async () => {
      // Create a test question
      const response = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'test-agent',
          agent_role: 'coder',
          text: 'Should I use TypeScript?',
          blocking_level: 'soft_block',
        });
      questionId = response.body.question.question_id;

      // Clear mocks after question creation
      vi.clearAllMocks();
    });

    it('should answer a question and broadcast to channel', async () => {
      const answer = 'Yes, use TypeScript for better type safety';

      const response = await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/answer`)
        .send({ answer })
        .expect(200);

      expect(response.body.question).toBeDefined();
      expect(response.body.question.status).toBe('answered');
      expect(response.body.question.answer).toBe(answer);
      expect(response.body.question.answered_at).toBeDefined();

      // Verify sendChannelMessage was called
      expect(sendChannelMessage).toHaveBeenCalledTimes(1);

      // Get the call arguments
      const [channel, body, payload] = (sendChannelMessage as ReturnType<typeof vi.fn>).mock.calls[0];

      // Verify channel format (uses full UUID)
      expect(channel).toBe(`#plan-${planId}`);

      // Verify body contains Q&A text
      expect(body).toContain('Q: Should I use TypeScript?');
      expect(body).toContain(`A: ${answer}`);

      // Verify QAMessagePayload structure
      expect(payload).toBeDefined();
      expect(payload.type).toBe('qa');
      expect(payload.questionId).toBe(questionId);
      expect(payload.questionText).toBe('Should I use TypeScript?');
      expect(payload.answerText).toBe(answer);
      expect(payload.agentName).toBe('test-agent');
      expect(payload.agentRole).toBe('coder');
      expect(payload.blockingLevel).toBe('soft_block');
      expect(payload.answeredAt).toBeDefined();

      // Verify sendMessage was called for both agent status update and broadcast
      expect(sendMessage).toHaveBeenCalledTimes(2);

      // First call: agent status update
      const [statusTo, statusBody, statusKind, statusData] = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(statusTo).toBe('*');
      expect(statusKind).toBe('agent_status');
      expect(statusData.type).toBe('agent_status_update');

      // Second call: question_answered broadcast
      const [eventTo, eventBody, eventKind, eventData] = (sendMessage as ReturnType<typeof vi.fn>).mock.calls[1];
      expect(eventTo).toBe('*');
      expect(eventKind).toBe('question_event');
      expect(eventData.type).toBe('question_answered');
      expect(eventData.questionId).toBe(questionId);
    });

    it('should return 400 for missing answer', async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/answer`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Missing required field: answer');
      expect(sendChannelMessage).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent question', async () => {
      await request(app)
        .post(`/api/plans/${planId}/questions/non-existent-id/answer`)
        .send({ answer: 'Yes' })
        .expect(404);

      expect(sendChannelMessage).not.toHaveBeenCalled();
    });

    it('should return 400 for already answered question', async () => {
      // Answer the question first
      await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/answer`)
        .send({ answer: 'Yes' })
        .expect(200);

      // Clear mocks
      vi.clearAllMocks();

      // Try to answer again
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/answer`)
        .send({ answer: 'No' })
        .expect(400);

      expect(response.body.error).toContain('Question is not pending');
      expect(sendChannelMessage).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/plans/:id/questions/:questionId/dismiss', () => {
    let questionId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'test-agent',
          agent_role: 'coder',
          text: 'Test question',
          blocking_level: 'preference',
          can_use_default: true,
          default_value: 'default',
        });
      questionId = response.body.question.question_id;
      vi.clearAllMocks();
    });

    it('should dismiss a question', async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/dismiss`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.question.status).toBe('dismissed');
    });

    it('should return 404 for non-existent question', async () => {
      await request(app)
        .post(`/api/plans/${planId}/questions/non-existent-id/dismiss`)
        .expect(404);
    });
  });

  describe('POST /api/plans/:id/questions/:questionId/subscribe', () => {
    let questionId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'agent-1',
          agent_role: 'coder',
          text: 'Shared question',
          blocking_level: 'soft_block',
        });
      questionId = response.body.question.question_id;
      vi.clearAllMocks();
    });

    it('should subscribe an agent to a question', async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/subscribe`)
        .send({ agent_id: 'agent-2' })
        .expect(200);

      expect(response.body.question).toBeDefined();
      expect(response.body.question.subscribers).toContain('agent-2');
    });

    it('should return 400 for missing agent_id', async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/${questionId}/subscribe`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Missing required field: agent_id');
    });

    it('should return 404 for non-existent question', async () => {
      await request(app)
        .post(`/api/plans/${planId}/questions/non-existent-id/subscribe`)
        .send({ agent_id: 'agent-2' })
        .expect(404);
    });
  });

  describe('POST /api/plans/:id/questions/check-duplicates', () => {
    it('should find duplicate questions', async () => {
      const questionText = 'Should I use TypeScript for this feature?';

      // Create a question
      await request(app)
        .post(`/api/plans/${planId}/questions`)
        .send({
          agent_id: 'test-agent',
          agent_role: 'coder',
          text: questionText,
          blocking_level: 'soft_block',
        });

      // Check for duplicates
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/check-duplicates`)
        .send({
          agent_id: 'test-agent',
          text: questionText,
        })
        .expect(200);

      expect(response.body.duplicates).toHaveLength(1);
      expect(response.body.duplicates[0].text).toContain('Should I use TypeScript');
    });

    it('should return empty array when no duplicates exist', async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/check-duplicates`)
        .send({
          agent_id: 'test-agent',
          text: 'Unique question',
        })
        .expect(200);

      expect(response.body.duplicates).toEqual([]);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post(`/api/plans/${planId}/questions/check-duplicates`)
        .send({ agent_id: 'test-agent' })
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .post('/api/plans/non-existent-id/questions/check-duplicates')
        .send({
          agent_id: 'test-agent',
          text: 'Test question',
        })
        .expect(404);
    });
  });
});
