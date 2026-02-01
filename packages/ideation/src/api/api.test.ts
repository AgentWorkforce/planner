/**
 * Ideation API Tests
 *
 * Integration tests for API endpoints.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createIdeationRouter } from './routes.js';
import { createHandlers, type PlannerClient } from './handlers.js';
import { SQLiteIdeationStorage } from '../storage/sqlite.js';

describe('Ideation API', () => {
  let app: express.Express;
  let storage: SQLiteIdeationStorage;

  beforeEach(async () => {
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();

    app = express();
    app.use(express.json());
    app.use('/api/ideation', createIdeationRouter(storage));
  });

  afterEach(async () => {
    await storage.close();
  });

  // ==========================================================================
  // Session CRUD
  // ==========================================================================

  describe('POST /sessions', () => {
    it('creates a session with initial_intent', async () => {
      const res = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Build a todo app' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('active');
      expect(res.body.source.initial_intent).toBe('Build a todo app');
      expect(res.body.transcript).toEqual([]);
      expect(res.body.understanding).toEqual({});
    });

    it('creates a session with initiative_id', async () => {
      const res = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test', initiative_id: 'init-123' });

      expect(res.status).toBe(201);
      expect(res.body.initiative_id).toBe('init-123');
    });

    it('returns 400 for missing initial_intent', async () => {
      const res = await request(app)
        .post('/api/ideation/sessions')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });
  });

  describe('GET /sessions', () => {
    it('lists all sessions', async () => {
      await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Session 1' });
      await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Session 2' });

      const res = await request(app).get('/api/ideation/sessions');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('filters by status', async () => {
      const created = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      await request(app)
        .post(`/api/ideation/sessions/${created.body.id}/abandon`);

      const active = await request(app)
        .get('/api/ideation/sessions?status=active');
      expect(active.body).toHaveLength(0);

      const abandoned = await request(app)
        .get('/api/ideation/sessions?status=abandoned');
      expect(abandoned.body).toHaveLength(1);
    });
  });

  describe('GET /sessions/:id', () => {
    it('gets a session by ID', async () => {
      const created = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .get(`/api/ideation/sessions/${created.body.id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
    });

    it('returns 404 for non-existent session', async () => {
      const res = await request(app)
        .get('/api/ideation/sessions/non-existent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /sessions/:id/abandon', () => {
    it('abandons a session', async () => {
      const created = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${created.body.id}/abandon`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('abandoned');
    });
  });

  // ==========================================================================
  // Messages
  // ==========================================================================

  describe('POST /sessions/:id/messages', () => {
    it('adds a user message', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/messages`)
        .send({ role: 'user', content: 'Hello!' });

      expect(res.status).toBe(200);
      expect(res.body.transcript).toHaveLength(1);
      expect(res.body.transcript[0].role).toBe('user');
      expect(res.body.transcript[0].content).toBe('Hello!');
    });

    it('adds an assistant message', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/messages`)
        .send({ role: 'assistant', content: 'How can I help?' });

      expect(res.status).toBe(200);
      expect(res.body.transcript[0].role).toBe('assistant');
    });

    it('preserves message order', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/messages`)
        .send({ role: 'user', content: 'First' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/messages`)
        .send({ role: 'assistant', content: 'Second' });

      expect(res.body.transcript).toHaveLength(2);
      expect(res.body.transcript[0].content).toBe('First');
      expect(res.body.transcript[1].content).toBe('Second');
    });
  });

  // ==========================================================================
  // Understanding
  // ==========================================================================

  describe('PUT /sessions/:id/understanding', () => {
    it('updates specialist observations', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding`)
        .send({
          specialist_name: 'Architect',
          observations: { patterns: ['microservices'], confidence: 'exploring' },
        });

      expect(res.status).toBe(200);
      expect(res.body.understanding['Architect']).toEqual({
        patterns: ['microservices'],
        confidence: 'exploring',
      });
    });

    it('preserves other specialists', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding`)
        .send({
          specialist_name: 'Architect',
          observations: { note: 'arch' },
        });

      const res = await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding`)
        .send({
          specialist_name: 'Designer',
          observations: { note: 'design' },
        });

      expect(res.body.understanding['Architect']).toBeDefined();
      expect(res.body.understanding['Designer']).toBeDefined();
    });
  });

  // ==========================================================================
  // Confidence
  // ==========================================================================

  describe('GET /sessions/:id/confidence', () => {
    it('returns confidence with no observations', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .get(`/api/ideation/sessions/${session.body.id}/confidence`);

      expect(res.status).toBe(200);
      expect(res.body.score).toBe(0);
      expect(res.body.level).toBe('low');
      expect(res.body.breakdown).toEqual({});
    });

    it('computes aggregate confidence from specialists', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding`)
        .send({
          specialist_name: 'Architect',
          observations: { confidence: 'confident' }, // 90
        });

      await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding`)
        .send({
          specialist_name: 'Designer',
          observations: { confidence: 'exploring' }, // 25
        });

      const res = await request(app)
        .get(`/api/ideation/sessions/${session.body.id}/confidence`);

      // (90 + 25) / 2 = 57.5, rounds to 58
      expect(res.body.score).toBe(58);
      expect(res.body.level).toBe('medium');
      expect(res.body.breakdown['Architect']).toBe('confident');
      expect(res.body.breakdown['Designer']).toBe('exploring');
    });
  });

  // ==========================================================================
  // Send to Planner
  // ==========================================================================

  describe('POST /sessions/:id/send-to-planner', () => {
    it('sends understanding to planner', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Build an API' });

      await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding`)
        .send({
          specialist_name: 'Architect',
          observations: { patterns: ['REST'] },
        });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.plan_id).toBeDefined();
      expect(res.body.plan_version).toBe(1);
      expect(res.body.sent_at).toBeDefined();
    });

    it('records send in session history', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({});

      const updated = await request(app)
        .get(`/api/ideation/sessions/${session.body.id}`);

      expect(updated.body.planner_sends).toHaveLength(1);
      expect(updated.body.planner_sends[0].payload.goal).toBe('Test');
    });

    it('uses goal override if provided', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Original intent' });

      await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({ goal: 'Refined goal' });

      const updated = await request(app)
        .get(`/api/ideation/sessions/${session.body.id}`);

      expect(updated.body.planner_sends[0].payload.goal).toBe('Refined goal');
    });
  });
});

// =============================================================================
// Planner Handoff Integration Tests
// =============================================================================

describe('Planner Handoff Integration', () => {
  let app: express.Express;
  let storage: SQLiteIdeationStorage;
  let mockPlannerClient: PlannerClient;
  let createPlanSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();

    // Create mock planner client
    createPlanSpy = vi.fn().mockResolvedValue({
      plan_id: 'plan-from-planner-123',
      version: 1,
    });

    mockPlannerClient = {
      createPlan: createPlanSpy,
    };

    app = express();
    app.use(express.json());

    // Create router with planner client
    const handlers = createHandlers({
      storage,
      plannerClient: mockPlannerClient,
    });

    // Register routes manually with handlers
    const router = express.Router();
    router.post('/sessions', handlers.createSession);
    router.get('/sessions', handlers.listSessions);
    router.get('/sessions/:id', handlers.getSession);
    router.post('/sessions/:id/abandon', handlers.abandonSession);
    router.post('/sessions/:id/messages', handlers.addMessage);
    router.put('/sessions/:id/understanding', handlers.updateUnderstanding);
    router.post('/sessions/:id/send-to-planner', handlers.sendToPlanner);
    router.get('/sessions/:id/confidence', handlers.getConfidence);
    router.get('/events', handlers.subscribeToEvents);
    router.get('/sessions/:id/events', handlers.subscribeToEvents);

    app.use('/api/ideation', router);
  });

  afterEach(async () => {
    await storage.close();
    vi.clearAllMocks();
  });

  describe('Planner Client Integration', () => {
    it('calls planner client with source and understanding', async () => {
      // Create session
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Build a REST API' });

      // Add understanding
      await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding`)
        .send({
          specialist_name: 'Architect',
          observations: { patterns: ['REST', 'microservices'], confidence: 'confident' },
        });

      await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding`)
        .send({
          specialist_name: 'Security',
          observations: { concerns: ['authentication'], confidence: 'exploring' },
        });

      // Send to planner
      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({ context: 'Additional context here' });

      expect(res.status).toBe(200);
      expect(res.body.plan_id).toBe('plan-from-planner-123');
      expect(res.body.plan_version).toBe(1);

      // Verify planner client was called correctly
      expect(createPlanSpy).toHaveBeenCalledTimes(1);
      const callArgs = createPlanSpy.mock.calls[0][0];

      expect(callArgs.goal).toBe('Build a REST API');
      expect(callArgs.context).toBe('Additional context here');
      expect(callArgs.source).toEqual({
        type: 'ideation',
        session_id: session.body.id,
      });
      expect(callArgs.understanding).toEqual({
        Architect: { patterns: ['REST', 'microservices'], confidence: 'confident' },
        Security: { concerns: ['authentication'], confidence: 'exploring' },
      });
    });

    it('passes initiative_id to planner', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({
          initial_intent: 'Test',
          initiative_id: 'init-abc-123',
        });

      await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({});

      expect(createPlanSpy).toHaveBeenCalledTimes(1);
      const callArgs = createPlanSpy.mock.calls[0][0];
      expect(callArgs.initiative_id).toBe('init-abc-123');
    });

    it('uses goal override when provided', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Original goal' });

      await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({ goal: 'Refined goal after discussion' });

      expect(createPlanSpy).toHaveBeenCalledTimes(1);
      const callArgs = createPlanSpy.mock.calls[0][0];
      expect(callArgs.goal).toBe('Refined goal after discussion');
    });

    it('records plan_id from planner response', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({});

      // Get updated session
      const updated = await request(app)
        .get(`/api/ideation/sessions/${session.body.id}`);

      expect(updated.body.planner_sends).toHaveLength(1);
      expect(updated.body.planner_sends[0].result.plan_id).toBe('plan-from-planner-123');
      expect(updated.body.planner_sends[0].result.plan_version).toBe(1);
    });

    it('allows multiple sends to planner from same session', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      // First send
      await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({});

      // Update planner mock for second call
      createPlanSpy.mockResolvedValueOnce({
        plan_id: 'plan-second-456',
        version: 1,
      });

      // Second send with refined goal
      await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({ goal: 'Refined after first plan' });

      // Check both sends recorded
      const updated = await request(app)
        .get(`/api/ideation/sessions/${session.body.id}`);

      expect(updated.body.planner_sends).toHaveLength(2);
      expect(updated.body.planner_sends[0].result.plan_id).toBe('plan-from-planner-123');
      expect(updated.body.planner_sends[1].result.plan_id).toBe('plan-second-456');
    });

    it('handles planner client errors gracefully', async () => {
      createPlanSpy.mockRejectedValueOnce(new Error('Planner API error'));

      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({});

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to send to planner');
    });

    it('session status remains active after sending to planner', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({});

      const updated = await request(app)
        .get(`/api/ideation/sessions/${session.body.id}`);

      // Session should remain active for continued ideation
      expect(updated.body.status).toBe('active');
    });
  });
});
