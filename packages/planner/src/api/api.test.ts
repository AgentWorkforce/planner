import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/index.js';
import { PlanStatus } from '../domain/status.js';

describe('API Integration Tests', () => {
  let storage: SqliteStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    app = createApp(storage);
  });

  afterEach(() => {
    storage.close();
  });

  describe('POST /api/plans', () => {
    it('should create a new plan with draft version', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal', context: 'Test context' })
        .expect(201);

      expect(response.body.plan).toBeDefined();
      expect(response.body.plan.plan_id).toBeDefined();
      expect(response.body.version).toBeDefined();
      expect(response.body.version.version).toBe(1);
      expect(response.body.version.status).toBe('draft');
      expect(response.body.version.summary.goal).toBe('Test goal');
      expect(response.body.version.summary.context).toBe('Test context');
    });

    it('should create plan with goal only', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' })
        .expect(201);

      expect(response.body.version.summary.goal).toBe('Test goal');
      expect(response.body.version.summary.context).toBeUndefined();
    });

    it('should return 400 for missing goal', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });

    it('should return 400 for empty goal', async () => {
      const response = await request(app)
        .post('/api/plans')
        .send({ goal: '' })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/plans', () => {
    it('should return empty array when no plans exist', async () => {
      const response = await request(app).get('/api/plans').expect(200);

      expect(response.body.plans).toEqual([]);
    });

    it('should return all plans', async () => {
      await request(app).post('/api/plans').send({ goal: 'Plan 1' });
      await request(app).post('/api/plans').send({ goal: 'Plan 2' });

      const response = await request(app).get('/api/plans').expect(200);

      expect(response.body.plans).toHaveLength(2);
    });

    it('should filter plans by status', async () => {
      // Create two plans
      const plan1Response = await request(app)
        .post('/api/plans')
        .send({ goal: 'Plan 1' });
      await request(app).post('/api/plans').send({ goal: 'Plan 2' });

      // Approve first plan
      const planId = plan1Response.body.plan.plan_id;
      storage.updateVersionStatus(planId, 1, PlanStatus.Approved);

      // Filter by draft
      const draftResponse = await request(app)
        .get('/api/plans?status=draft')
        .expect(200);
      expect(draftResponse.body.plans).toHaveLength(1);

      // Filter by approved
      const approvedResponse = await request(app)
        .get('/api/plans?status=approved')
        .expect(200);
      expect(approvedResponse.body.plans).toHaveLength(1);
    });
  });

  describe('GET /api/plans/:id', () => {
    it('should return plan with latest version', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .get(`/api/plans/${planId}`)
        .expect(200);

      expect(response.body.plan.plan_id).toBe(planId);
      expect(response.body.version.version).toBe(1);
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/plans/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });
  });

  describe('PUT /api/plans/:id', () => {
    it('should update draft version', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Original goal' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .put(`/api/plans/${planId}`)
        .send({ goal: 'Updated goal', context: 'New context' })
        .expect(200);

      expect(response.body.version.version).toBe(2); // New version created
      expect(response.body.version.summary.goal).toBe('Updated goal');
      expect(response.body.version.summary.context).toBe('New context');
    });

    it('should return 400 for approved version', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;
      storage.updateVersionStatus(planId, 1, PlanStatus.Approved);

      const response = await request(app)
        .put(`/api/plans/${planId}`)
        .send({ goal: 'Updated goal' })
        .expect(400);

      expect(response.body.error).toBe('Cannot update approved or published version');
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .put('/api/plans/non-existent-id')
        .send({ goal: 'Updated goal' })
        .expect(404);
    });
  });

  describe('GET /api/plans/:id/versions', () => {
    it('should list all versions', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;

      // Create another version
      await request(app)
        .post(`/api/plans/${planId}/versions`)
        .send({ goal: 'Version 2' });

      const response = await request(app)
        .get(`/api/plans/${planId}/versions`)
        .expect(200);

      expect(response.body.versions).toHaveLength(2);
      expect(response.body.versions[0]!.version).toBe(1);
      expect(response.body.versions[1]!.version).toBe(2);
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .get('/api/plans/non-existent-id/versions')
        .expect(404);
    });
  });

  describe('GET /api/plans/:id/versions/:version', () => {
    it('should return specific version', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .get(`/api/plans/${planId}/versions/1`)
        .expect(200);

      expect(response.body.version.version).toBe(1);
    });

    it('should return 404 for non-existent version', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;

      await request(app)
        .get(`/api/plans/${planId}/versions/999`)
        .expect(404);
    });

    it('should return 400 for invalid version number', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .get(`/api/plans/${planId}/versions/invalid`)
        .expect(400);

      expect(response.body.error).toBe('Invalid version number');
    });
  });

  describe('POST /api/plans/:id/versions', () => {
    it('should create new version from latest', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Original goal' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .post(`/api/plans/${planId}/versions`)
        .send({ goal: 'New version goal' })
        .expect(201);

      expect(response.body.version.version).toBe(2);
      expect(response.body.version.summary.goal).toBe('New version goal');
    });

    it('should preserve existing values when not provided', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Original goal', context: 'Original context' });

      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .post(`/api/plans/${planId}/versions`)
        .send({})
        .expect(201);

      expect(response.body.version.summary.goal).toBe('Original goal');
      expect(response.body.version.summary.context).toBe('Original context');
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .post('/api/plans/non-existent-id/versions')
        .send({})
        .expect(404);
    });
  });

  describe('Error handling', () => {
    it('should return JSON error for invalid JSON body', async () => {
      const response = await request(app)
        .post('/api/plans')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });
});
