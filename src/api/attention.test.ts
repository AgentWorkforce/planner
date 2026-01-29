import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';
import { PlanStatus } from '../domain/status.js';
import { randomUUID } from 'crypto';

describe('Attention Signals Integration Tests', () => {
  let storage: SqliteStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    app = createApp(storage);
  });

  afterEach(() => {
    storage.close();
  });

  describe('GET /api/plans with include_attention=true', () => {
    it('should return attention_types when include_attention=true', async () => {
      await request(app).post('/api/plans').send({ goal: 'Test plan' });

      const response = await request(app)
        .get('/api/plans?include_attention=true')
        .expect(200);

      expect(response.body.plans).toHaveLength(1);
      expect(response.body.plans[0].attention_types).toBeDefined();
      expect(Array.isArray(response.body.plans[0].attention_types)).toBe(true);
    });

    it('should not return attention_types without include_attention param (backward compatible)', async () => {
      await request(app).post('/api/plans').send({ goal: 'Test plan' });

      const response = await request(app).get('/api/plans').expect(200);

      expect(response.body.plans).toHaveLength(1);
      expect(response.body.plans[0].attention_types).toBeUndefined();
    });

    it('should return awaiting_approval for draft with submitted_at', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test plan' });

      const planId = createResponse.body.plan.plan_id;

      // Submit the version
      await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`)
        .expect(200);

      const response = await request(app)
        .get('/api/plans?include_attention=true')
        .expect(200);

      expect(response.body.plans[0].attention_types).toContain('awaiting_approval');
    });

    it('should return change_request for plan with pending change request', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test plan' });

      const planId = createResponse.body.plan.plan_id;

      // Create a pending change request
      storage.createChangeRequest({
        change_request_id: randomUUID(),
        run_id: randomUUID(),
        plan_id: planId,
        reason: 'Test change request',
        suggested_changes: {},
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const response = await request(app)
        .get('/api/plans?include_attention=true')
        .expect(200);

      expect(response.body.plans[0].attention_types).toContain('change_request');
    });

    it('should return unread_comments for plan with unresolved comments', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test plan' });

      const planId = createResponse.body.plan.plan_id;
      const stepId = randomUUID();

      // Add a step to comment on
      const updateResponse = await request(app)
        .put(`/api/plans/${planId}`)
        .send({
          steps: [
            {
              step_id: stepId,
              title: 'Test step',
              dependencies: [],
            },
          ],
        })
        .expect(200);

      const latestVersion = updateResponse.body.version.version;

      // Create an unresolved comment on the latest version
      await request(app)
        .post(`/api/plans/${planId}/versions/${latestVersion}/comments`)
        .send({
          step_id: stepId,
          author: 'tester',
          content: 'Test comment',
        })
        .expect(201);

      const response = await request(app)
        .get('/api/plans?include_attention=true')
        .expect(200);

      expect(response.body.plans[0].attention_types).toContain('unread_comments');
    });

    it('should return stale_draft for draft not updated in >7 days', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test plan' });

      const planId = createResponse.body.plan.plan_id;

      // Manually set updated_at to 8 days ago
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      const staleDate = eightDaysAgo.toISOString();

      // Update directly in database
      storage.transaction(() => {
        const db = (storage as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
        db.prepare('UPDATE versions SET updated_at = ? WHERE plan_id = ?').run(staleDate, planId);
        db.prepare('UPDATE plans SET updated_at = ? WHERE plan_id = ?').run(staleDate, planId);
      });

      const response = await request(app)
        .get('/api/plans?include_attention=true')
        .expect(200);

      expect(response.body.plans[0].attention_types).toContain('stale_draft');
    });

    it('should return active for recently updated draft', async () => {
      await request(app).post('/api/plans').send({ goal: 'Test plan' });

      const response = await request(app)
        .get('/api/plans?include_attention=true')
        .expect(200);

      // Just-created plan should be active
      expect(response.body.plans[0].attention_types).toContain('active');
    });

    it('should return multiple attention types when applicable', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test plan' });

      const planId = createResponse.body.plan.plan_id;
      const stepId = randomUUID();

      // Add a step
      const updateResponse = await request(app)
        .put(`/api/plans/${planId}`)
        .send({
          steps: [
            {
              step_id: stepId,
              title: 'Test step',
              dependencies: [],
            },
          ],
        })
        .expect(200);

      const latestVersion = updateResponse.body.version.version;

      // Submit the version (awaiting_approval)
      await request(app)
        .post(`/api/plans/${planId}/versions/${latestVersion}/submit`)
        .expect(200);

      // Create a pending change request (change_request)
      storage.createChangeRequest({
        change_request_id: randomUUID(),
        run_id: randomUUID(),
        plan_id: planId,
        reason: 'Test change request',
        suggested_changes: {},
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Add unresolved comment (unread_comments)
      await request(app)
        .post(`/api/plans/${planId}/versions/${latestVersion}/comments`)
        .send({
          step_id: stepId,
          author: 'tester',
          content: 'Test comment',
        })
        .expect(201);

      const response = await request(app)
        .get('/api/plans?include_attention=true')
        .expect(200);

      const attentionTypes = response.body.plans[0].attention_types;
      expect(attentionTypes).toContain('awaiting_approval');
      expect(attentionTypes).toContain('change_request');
      expect(attentionTypes).toContain('unread_comments');
      expect(attentionTypes).toContain('active'); // Recently updated
    });

    it('should return none when no attention signals apply', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test plan' });

      const planId = createResponse.body.plan.plan_id;

      // Approve and publish the plan (removes draft-related signals)
      storage.updateVersionStatus(planId, 1, PlanStatus.Approved);
      storage.updateVersionStatus(planId, 1, PlanStatus.Published);

      // Make it older than active threshold but not stale
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const date = twoDaysAgo.toISOString();

      storage.transaction(() => {
        const db = (storage as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
        db.prepare('UPDATE versions SET updated_at = ? WHERE plan_id = ?').run(date, planId);
      });

      const response = await request(app)
        .get('/api/plans?include_attention=true')
        .expect(200);

      // Published plan with no execution status and no comments/change requests
      expect(response.body.plans[0].attention_types).toContain('none');
    });

    it('should work with status filter', async () => {
      // Create two plans
      const plan1 = await request(app).post('/api/plans').send({ goal: 'Plan 1' });
      await request(app).post('/api/plans').send({ goal: 'Plan 2' });

      // Approve first plan
      const planId = plan1.body.plan.plan_id;
      storage.updateVersionStatus(planId, 1, PlanStatus.Approved);

      // Filter by approved with attention
      const response = await request(app)
        .get('/api/plans?status=approved&include_attention=true')
        .expect(200);

      expect(response.body.plans).toHaveLength(1);
      expect(response.body.plans[0].attention_types).toBeDefined();
    });
  });
});
