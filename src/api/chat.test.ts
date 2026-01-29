import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';
import type { PlanStorage } from '../storage/interface.js';
import type { PlanVersion } from '../domain/plan.js';

// Mock relay modules
vi.mock('../relay/chat.js', () => ({
  sendToAgent: vi.fn().mockResolvedValue({ text: 'Mock agent response' }),
  notifyAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../relay/service.js', () => ({
  getRelayMode: vi.fn().mockReturnValue('mock'),
  isRelayAvailable: vi.fn().mockReturnValue(false),
}));

describe('Chat API', () => {
  let storage: PlanStorage;
  let app: ReturnType<typeof createApp>;
  let planId: string;
  let version: PlanVersion;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    app = createApp(storage);

    // Create a test plan
    const plan = storage.createPlan({
      plan_id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    planId = plan.plan_id;

    // Create a version with steps
    version = storage.createVersion({
      plan_id: planId,
      version: 1,
      status: 'draft',
      summary: {
        goal: 'Test goal',
        context: 'Test context',
      },
      steps: [
        {
          step_id: 'step-1',
          title: 'Test step',
          dependencies: [],
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  describe('POST /api/ai/chat', () => {
    it('returns mock response when no active session', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          message: 'Hello',
          context: {
            plan_id: planId,
            version: 1,
            goal: 'Test goal',
            steps: [],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('session_status', 'none');
    });

    it('requires message field', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          context: {
            plan_id: planId,
            version: 1,
            goal: 'Test goal',
            steps: [],
          },
        });

      expect(response.status).toBe(400);
    });

    it('requires context with plan_id', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          message: 'Hello',
          context: {},
        });

      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent plan', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          message: 'Hello',
          context: {
            plan_id: 'non-existent',
            version: 1,
            goal: 'Test goal',
            steps: [],
          },
        });

      expect(response.status).toBe(404);
    });

    it('returns response for criteria request', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({
          message: 'add acceptance criteria',
          context: {
            plan_id: planId,
            version: 1,
            goal: version.summary.goal,
            steps: version.steps.map((s) => ({
              step_id: s.step_id,
              title: s.title,
              description: s.description,
              dependencies: s.dependencies,
              acceptance_criteria_count: 0,
              has_gate: false,
            })),
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('session_status');
      // Suggestion may or may not be present depending on mock implementation
    });
  });

  describe('POST /api/ai/suggestions/apply', () => {
    it('requires all fields', async () => {
      const response = await request(app)
        .post('/api/ai/suggestions/apply')
        .send({
          plan_id: planId,
        });

      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent plan', async () => {
      const response = await request(app)
        .post('/api/ai/suggestions/apply')
        .send({
          plan_id: 'non-existent',
          version: 1,
          suggestion_type: 'add_step',
          suggestion_data: { title: 'New step' },
        });

      expect(response.status).toBe(404);
    });

    it('returns 404 for non-existent version', async () => {
      const response = await request(app)
        .post('/api/ai/suggestions/apply')
        .send({
          plan_id: planId,
          version: 999,
          suggestion_type: 'add_step',
          suggestion_data: { title: 'New step' },
        });

      expect(response.status).toBe(404);
    });

    it('applies add_step suggestion', async () => {
      const response = await request(app)
        .post('/api/ai/suggestions/apply')
        .send({
          plan_id: planId,
          version: 1,
          suggestion_type: 'add_step',
          suggestion_data: {
            title: 'New step',
            description: 'A new step',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('step');
    });

    it('applies add_criteria suggestion', async () => {
      const response = await request(app)
        .post('/api/ai/suggestions/apply')
        .send({
          plan_id: planId,
          version: 1,
          suggestion_type: 'add_criteria',
          suggestion_data: {
            step_id: 'step-1',
            description: 'Test passes',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });

    it('returns error for unknown suggestion type', async () => {
      const response = await request(app)
        .post('/api/ai/suggestions/apply')
        .send({
          plan_id: planId,
          version: 1,
          suggestion_type: 'unknown_type',
          suggestion_data: {},
        });

      expect(response.status).toBe(400);
    });
  });
});
