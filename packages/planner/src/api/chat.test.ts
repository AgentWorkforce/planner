import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/index.js';
import type { PlanStorage } from '../storage/interface.js';
import type { PlanVersion } from '../domain/plan.js';

// Mock relay modules
vi.mock('../relay/chat.js', () => ({
  sendToAgent: vi.fn().mockResolvedValue({ text: 'Mock agent response' }),
  notifyAgent: vi.fn().mockResolvedValue(undefined),
}));

describe('Chat API', () => {
  let storage: PlanStorage & { listOrganizations: () => { org_id: string }[] };
  let app: ReturnType<typeof createApp>;
  let planId: string;
  let version: PlanVersion;
  let testOrgId: string;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    app = createApp(storage);

    // Get default org created by migrations
    const orgs = storage.listOrganizations();
    testOrgId = orgs[0]!.org_id;

    // Create a test plan
    const plan = storage.createPlan({
      plan_id: crypto.randomUUID(),
      org_id: testOrgId,
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
