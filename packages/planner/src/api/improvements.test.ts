import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';
import type { PlanStorage } from '../storage/interface.js';
import type { PlanVersion } from '../domain/plan.js';
import { createImprovement, type ImprovementType } from '../domain/improvement.js';

describe('Improvements API Integration Tests', () => {
  let storage: PlanStorage & { close: () => void; listOrganizations: () => { org_id: string }[] };
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

  afterEach(() => {
    storage.close();
  });

  describe('GET /plans/:id/versions/:version/improvements', () => {
    it('should return empty array when no improvements exist', async () => {
      const response = await request(app)
        .get(`/api/plans/${planId}/versions/1/improvements`)
        .expect(200);

      expect(response.body.improvements).toEqual([]);
    });

    it('should return all improvements for a version', async () => {
      // Create some improvements
      storage.createImprovement(createImprovement({
        plan_id: planId,
        version: 1,
        type: 'missing_criteria',
        description: 'Missing acceptance criteria',
      }));
      storage.createImprovement(createImprovement({
        plan_id: planId,
        version: 1,
        type: 'unclear_description',
        description: 'Description is vague',
      }));

      const response = await request(app)
        .get(`/api/plans/${planId}/versions/1/improvements`)
        .expect(200);

      expect(response.body.improvements).toHaveLength(2);
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .get('/api/plans/non-existent/versions/1/improvements')
        .expect(404);
    });

    it('should return 404 for non-existent version', async () => {
      await request(app)
        .get(`/api/plans/${planId}/versions/99/improvements`)
        .expect(404);
    });
  });

  describe('GET /plans/:id/versions/:version/improvements/pending', () => {
    it('should return only pending improvements', async () => {
      // Create improvements with different statuses
      const pending = createImprovement({
        plan_id: planId,
        version: 1,
        type: 'missing_criteria',
        description: 'Pending improvement',
      });
      storage.createImprovement(pending);

      const accepted = createImprovement({
        plan_id: planId,
        version: 1,
        type: 'unclear_description',
        description: 'Accepted improvement',
      });
      storage.createImprovement(accepted);
      storage.updateImprovementStatus(accepted.improvement_id, 'accepted');

      const dismissed = createImprovement({
        plan_id: planId,
        version: 1,
        type: 'redundant_step',
        description: 'Dismissed improvement',
      });
      storage.createImprovement(dismissed);
      storage.updateImprovementStatus(dismissed.improvement_id, 'dismissed');

      const response = await request(app)
        .get(`/api/plans/${planId}/versions/1/improvements/pending`)
        .expect(200);

      expect(response.body.improvements).toHaveLength(1);
      expect(response.body.improvements[0].improvement_id).toBe(pending.improvement_id);
    });
  });

  describe('GET /plans/:id/versions/:version/improvements/:improvementId', () => {
    it('should return a specific improvement', async () => {
      const improvement = createImprovement({
        plan_id: planId,
        version: 1,
        type: 'missing_criteria',
        description: 'Test improvement',
        step_id: 'step-1',
        suggested_change: { acceptance_criteria: [{ id: 'ac-1', description: 'Test' }] },
      });
      storage.createImprovement(improvement);

      const response = await request(app)
        .get(`/api/plans/${planId}/versions/1/improvements/${improvement.improvement_id}`)
        .expect(200);

      expect(response.body.improvement.improvement_id).toBe(improvement.improvement_id);
      expect(response.body.improvement.type).toBe('missing_criteria');
      expect(response.body.improvement.step_id).toBe('step-1');
    });

    it('should return 404 for non-existent improvement', async () => {
      await request(app)
        .get(`/api/plans/${planId}/versions/1/improvements/non-existent`)
        .expect(404);
    });
  });

  describe('POST /plans/:id/versions/:version/improvements/:improvementId/accept', () => {
    it('should accept a pending improvement', async () => {
      const improvement = createImprovement({
        plan_id: planId,
        version: 1,
        type: 'missing_criteria',
        description: 'Test improvement',
      });
      storage.createImprovement(improvement);

      const response = await request(app)
        .post(`/api/plans/${planId}/versions/1/improvements/${improvement.improvement_id}/accept`)
        .expect(200);

      expect(response.body.improvement.status).toBe('accepted');
    });

    it('should return 400 for already accepted improvement', async () => {
      const improvement = createImprovement({
        plan_id: planId,
        version: 1,
        type: 'missing_criteria',
        description: 'Test improvement',
      });
      storage.createImprovement(improvement);
      storage.updateImprovementStatus(improvement.improvement_id, 'accepted');

      await request(app)
        .post(`/api/plans/${planId}/versions/1/improvements/${improvement.improvement_id}/accept`)
        .expect(400);
    });

    it('should return 404 for non-existent improvement', async () => {
      await request(app)
        .post(`/api/plans/${planId}/versions/1/improvements/non-existent/accept`)
        .expect(404);
    });
  });

  describe('POST /plans/:id/versions/:version/improvements/:improvementId/dismiss', () => {
    it('should dismiss a pending improvement', async () => {
      const improvement = createImprovement({
        plan_id: planId,
        version: 1,
        type: 'missing_criteria',
        description: 'Test improvement',
      });
      storage.createImprovement(improvement);

      const response = await request(app)
        .post(`/api/plans/${planId}/versions/1/improvements/${improvement.improvement_id}/dismiss`)
        .expect(200);

      expect(response.body.improvement.status).toBe('dismissed');
    });

    it('should return 400 for already dismissed improvement', async () => {
      const improvement = createImprovement({
        plan_id: planId,
        version: 1,
        type: 'missing_criteria',
        description: 'Test improvement',
      });
      storage.createImprovement(improvement);
      storage.updateImprovementStatus(improvement.improvement_id, 'dismissed');

      await request(app)
        .post(`/api/plans/${planId}/versions/1/improvements/${improvement.improvement_id}/dismiss`)
        .expect(400);
    });

    it('should return 404 for non-existent improvement', async () => {
      await request(app)
        .post(`/api/plans/${planId}/versions/1/improvements/non-existent/dismiss`)
        .expect(404);
    });
  });

  describe('Full workflow', () => {
    it('should support the full improvement lifecycle', async () => {
      // 1. Create improvement via MCP tool (simulated via storage)
      const improvement = createImprovement({
        plan_id: planId,
        version: 1,
        type: 'missing_criteria',
        description: 'Step lacks acceptance criteria',
        step_id: 'step-1',
        suggested_change: {
          acceptance_criteria: [{ id: 'ac-1', description: 'Tests pass' }],
        },
      });
      storage.createImprovement(improvement);

      // 2. List pending improvements
      const listResponse = await request(app)
        .get(`/api/plans/${planId}/versions/1/improvements/pending`)
        .expect(200);

      expect(listResponse.body.improvements).toHaveLength(1);
      expect(listResponse.body.improvements[0].status).toBe('pending');

      // 3. Get specific improvement details
      const getResponse = await request(app)
        .get(`/api/plans/${planId}/versions/1/improvements/${improvement.improvement_id}`)
        .expect(200);

      expect(getResponse.body.improvement.suggested_change).toEqual({
        acceptance_criteria: [{ id: 'ac-1', description: 'Tests pass' }],
      });

      // 4. Accept the improvement
      const acceptResponse = await request(app)
        .post(`/api/plans/${planId}/versions/1/improvements/${improvement.improvement_id}/accept`)
        .expect(200);

      expect(acceptResponse.body.improvement.status).toBe('accepted');

      // 5. Verify it's no longer in pending list
      const pendingResponse = await request(app)
        .get(`/api/plans/${planId}/versions/1/improvements/pending`)
        .expect(200);

      expect(pendingResponse.body.improvements).toHaveLength(0);
    });
  });
});
