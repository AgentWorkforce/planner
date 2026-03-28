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

  describe('PATCH /sessions/:id', () => {
    it('updates session title', async () => {
      const created = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Original Title' });

      const res = await request(app)
        .patch(`/api/ideation/sessions/${created.body.id}`)
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.source.initial_intent).toBe('Updated Title');
    });

    it('returns 404 for non-existent session', async () => {
      const res = await request(app)
        .patch('/api/ideation/sessions/non-existent')
        .send({ title: 'Test' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });

    it('returns 400 for invalid request body', async () => {
      const created = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .patch(`/api/ideation/sessions/${created.body.id}`)
        .send({ title: '' }); // Empty title is invalid

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
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

  describe('PUT /sessions/:id/understanding/:specialist', () => {
    it('updates specialist observations', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding/Architect`)
        .send({
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
        .put(`/api/ideation/sessions/${session.body.id}/understanding/Architect`)
        .send({
          observations: { note: 'arch' },
        });

      const res = await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding/Designer`)
        .send({
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
        .put(`/api/ideation/sessions/${session.body.id}/understanding/Architect`)
        .send({
          observations: { confidence: 'confident' }, // 90
        });

      await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding/Designer`)
        .send({
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
    it('returns 503 when no planner client configured', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Build an API' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({});

      expect(res.status).toBe(503);
      expect(res.body.error).toBe('Planner service unavailable');
    });
  });

  // ==========================================================================
  // Block CRUD
  // ==========================================================================

  describe('GET /sessions/:id/blocks', () => {
    it('returns empty array for new session', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .get(`/api/ideation/sessions/${session.body.id}/blocks`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 404 for non-existent session', async () => {
      const res = await request(app)
        .get('/api/ideation/sessions/non-existent/blocks');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });
  });

  describe('POST /sessions/:id/blocks', () => {
    it('creates a block with required fields', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/blocks`)
        .send({
          type: 'feature',
          title: 'User Authentication',
          keyword: 'auth',
          emoji: '🔐',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.type).toBe('feature');
      expect(res.body.title).toBe('User Authentication');
      expect(res.body.keyword).toBe('auth');
      expect(res.body.emoji).toBe('🔐');
      expect(res.body.status).toBe('forming');
      expect(res.body.confidence).toBe(0);
      expect(res.body.specialist).toBe('user');
      expect(res.body.sourceContext).toBe('user-created');
      expect(res.body.content).toBe('');
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.curatedAt).toBeNull();
    });

    it('creates a block with optional fields', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/blocks`)
        .send({
          type: 'entity',
          title: 'User Model',
          keyword: 'user',
          emoji: '👤',
          content: '## User Entity\n- id\n- email\n- password',
          confidence: 75,
          specialist: 'Architect',
          sourceContext: 'turn-5',
        });

      expect(res.status).toBe(201);
      expect(res.body.content).toBe('## User Entity\n- id\n- email\n- password');
      expect(res.body.confidence).toBe(75);
      expect(res.body.specialist).toBe('Architect');
      expect(res.body.sourceContext).toBe('turn-5');
    });

    it('returns 400 for missing required fields', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/blocks`)
        .send({
          type: 'feature',
          // Missing: title, keyword, emoji
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });

    it('returns 404 for non-existent session', async () => {
      const res = await request(app)
        .post('/api/ideation/sessions/non-existent/blocks')
        .send({
          type: 'feature',
          title: 'Test',
          keyword: 'test',
          emoji: '🧪',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Session not found');
    });
  });

  describe('PATCH /sessions/:id/blocks/:blockId', () => {
    it('updates block fields', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const created = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/blocks`)
        .send({
          type: 'feature',
          title: 'Original',
          keyword: 'orig',
          emoji: '📝',
        });

      const res = await request(app)
        .patch(`/api/ideation/sessions/${session.body.id}/blocks/${created.body.id}`)
        .send({
          title: 'Updated Title',
          content: 'New content',
          confidence: 50,
          status: 'emerging',
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
      expect(res.body.content).toBe('New content');
      expect(res.body.confidence).toBe(50);
      expect(res.body.status).toBe('emerging');
      // Unchanged fields should remain
      expect(res.body.keyword).toBe('orig');
      expect(res.body.emoji).toBe('📝');
    });

    it('returns 404 for non-existent block', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .patch(`/api/ideation/sessions/${session.body.id}/blocks/non-existent`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Block not found');
    });

    it('returns 400 for invalid status value', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const created = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/blocks`)
        .send({
          type: 'feature',
          title: 'Test',
          keyword: 'test',
          emoji: '🧪',
        });

      const res = await request(app)
        .patch(`/api/ideation/sessions/${session.body.id}/blocks/${created.body.id}`)
        .send({ status: 'curated' }); // Cannot set to 'curated' via PATCH

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request');
    });
  });

  describe('DELETE /sessions/:id/blocks/:blockId', () => {
    it('deletes a block', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const created = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/blocks`)
        .send({
          type: 'feature',
          title: 'To Delete',
          keyword: 'del',
          emoji: '🗑️',
        });

      const res = await request(app)
        .delete(`/api/ideation/sessions/${session.body.id}/blocks/${created.body.id}`);

      expect(res.status).toBe(204);

      // Verify block is gone
      const blocks = await request(app)
        .get(`/api/ideation/sessions/${session.body.id}/blocks`);

      expect(blocks.body).toHaveLength(0);
    });

    it('returns 404 for non-existent block', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .delete(`/api/ideation/sessions/${session.body.id}/blocks/non-existent`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Block not found');
    });
  });

  describe('POST /sessions/:id/blocks/:blockId/curate', () => {
    it('sets block status to curated', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const created = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/blocks`)
        .send({
          type: 'feature',
          title: 'Ready Block',
          keyword: 'ready',
          emoji: '✅',
        });

      // Update to ready status first
      await request(app)
        .patch(`/api/ideation/sessions/${session.body.id}/blocks/${created.body.id}`)
        .send({ status: 'ready' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/blocks/${created.body.id}/curate`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('curated');
      expect(res.body.curatedAt).toBeDefined();
      expect(res.body.curatedAt).not.toBeNull();
    });

    it('returns 404 for non-existent block', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      const res = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/blocks/non-existent/curate`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Block not found');
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
  let createVersionSpy: ReturnType<typeof vi.fn>;
  let updatePlanSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();

    // Create mock planner client
    createPlanSpy = vi.fn().mockResolvedValue({
      plan_id: 'plan-from-planner-123',
      version: 1,
    });

    createVersionSpy = vi.fn().mockResolvedValue({
      plan_id: 'plan-from-planner-123',
      version: 2,
    });

    updatePlanSpy = vi.fn().mockResolvedValue(undefined);

    mockPlannerClient = {
      createPlan: createPlanSpy,
      createVersion: createVersionSpy,
      updatePlan: updatePlanSpy,
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
    router.put('/sessions/:id/understanding/:specialist', handlers.updateUnderstanding);
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
      const arch = await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding/Architect`)
        .send({
          observations: { patterns: ['REST', 'microservices'], confidence: 'confident' },
        });

      expect(arch.status).toBe(200);

      const sec = await request(app)
        .put(`/api/ideation/sessions/${session.body.id}/understanding/Security`)
        .send({
          observations: { concerns: ['authentication'], confidence: 'exploring' },
        });

      expect(sec.status).toBe(200);

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
        _blocks: {
          observations: [],
          keywords: [],
          blocks: [],
        },
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

    it('creates new version on subsequent sends to same plan', async () => {
      const session = await request(app)
        .post('/api/ideation/sessions')
        .send({ initial_intent: 'Test' });

      // First send - creates plan
      const firstRes = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({});

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.plan_id).toBe('plan-from-planner-123');
      expect(firstRes.body.plan_version).toBe(1);
      expect(createPlanSpy).toHaveBeenCalledTimes(1);

      // Second send - should create version 2 on same plan
      const secondRes = await request(app)
        .post(`/api/ideation/sessions/${session.body.id}/send-to-planner`)
        .send({ goal: 'Refined after first plan' });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.plan_id).toBe('plan-from-planner-123'); // Same plan
      expect(secondRes.body.plan_version).toBe(2); // New version
      expect(createVersionSpy).toHaveBeenCalledTimes(1);
      expect(updatePlanSpy).toHaveBeenCalledTimes(1);

      // Verify createVersion was called with correct params
      const versionCallArgs = createVersionSpy.mock.calls[0][0];
      expect(versionCallArgs.plan_id).toBe('plan-from-planner-123');
      expect(versionCallArgs.goal).toBe('Refined after first plan');

      // Check both sends recorded
      const updated = await request(app)
        .get(`/api/ideation/sessions/${session.body.id}`);

      expect(updated.body.planner_sends).toHaveLength(2);
      expect(updated.body.planner_sends[0].result.plan_id).toBe('plan-from-planner-123');
      expect(updated.body.planner_sends[0].result.plan_version).toBe(1);
      expect(updated.body.planner_sends[1].result.plan_id).toBe('plan-from-planner-123');
      expect(updated.body.planner_sends[1].result.plan_version).toBe(2);
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
