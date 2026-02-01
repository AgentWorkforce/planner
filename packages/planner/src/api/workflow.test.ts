import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';

describe('Workflow API Integration Tests', () => {
  let storage: SqliteStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    app = createApp(storage);
  });

  afterEach(() => {
    storage.close();
  });

  describe('POST /api/plans/:id/versions/:version/submit', () => {
    it('should submit a draft version', async () => {
      // Create a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });
      const planId = createResponse.body.plan.plan_id;

      // Submit the version
      const response = await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`)
        .expect(200);

      expect(response.body.version.submitted_at).toBeDefined();
      expect(response.body.version.status).toBe('draft');
    });

    it('should return 400 if already submitted', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });
      const planId = createResponse.body.plan.plan_id;

      // Submit once
      await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`)
        .expect(200);

      // Try to submit again
      const response = await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`)
        .expect(400);

      expect(response.body.error).toBe('Version is already submitted');
    });

    it('should return 404 for non-existent plan', async () => {
      await request(app)
        .post('/api/plans/non-existent-id/versions/1/submit')
        .expect(404);
    });
  });

  describe('POST /api/plans/:id/versions/:version/approve', () => {
    it('should approve a submitted version', async () => {
      // Create and submit a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });
      const planId = createResponse.body.plan.plan_id;

      await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`)
        .expect(200);

      // Approve the version
      const response = await request(app)
        .post(`/api/plans/${planId}/versions/1/approve`)
        .send({ approver: 'test-user' })
        .expect(200);

      expect(response.body.version.status).toBe('approved');
      expect(response.body.version.approval_info).toBeDefined();
      expect(response.body.version.approval_info.approver).toBe('test-user');
      expect(response.body.version.approval_info.approved_at).toBeDefined();
    });

    it('should return 400 if not submitted', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });
      const planId = createResponse.body.plan.plan_id;

      // Try to approve without submitting first
      const response = await request(app)
        .post(`/api/plans/${planId}/versions/1/approve`)
        .send({ approver: 'test-user' })
        .expect(400);

      expect(response.body.error).toBe('Version must be submitted before approval');
    });

    it('should return 400 if approver is missing', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });
      const planId = createResponse.body.plan.plan_id;

      await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`);

      const response = await request(app)
        .post(`/api/plans/${planId}/versions/1/approve`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/plans/:id/versions/:version/publish', () => {
    it('should publish an approved version', async () => {
      // Create, submit, and approve a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });
      const planId = createResponse.body.plan.plan_id;

      await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`);

      await request(app)
        .post(`/api/plans/${planId}/versions/1/approve`)
        .send({ approver: 'test-user' });

      // Publish the version
      const response = await request(app)
        .post(`/api/plans/${planId}/versions/1/publish`)
        .expect(200);

      expect(response.body.version.status).toBe('published');
      expect(response.body.plan_ref).toBe(`${planId}:1`);
    });

    it('should return 400 if not approved', async () => {
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });
      const planId = createResponse.body.plan.plan_id;

      // Try to publish without approval
      const response = await request(app)
        .post(`/api/plans/${planId}/versions/1/publish`)
        .expect(400);

      expect(response.body.error).toContain('must be approved');
    });
  });

  describe('Immutability enforcement', () => {
    it('should prevent updating approved version via PUT', async () => {
      // Create, submit, and approve a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });
      const planId = createResponse.body.plan.plan_id;

      await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`);

      await request(app)
        .post(`/api/plans/${planId}/versions/1/approve`)
        .send({ approver: 'test-user' });

      // Try to update
      const response = await request(app)
        .put(`/api/plans/${planId}`)
        .send({ goal: 'Updated goal' })
        .expect(400);

      expect(response.body.error).toBe('Cannot update approved or published version');
    });

    it('should prevent updating published version via PUT', async () => {
      // Create, submit, approve, and publish a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });
      const planId = createResponse.body.plan.plan_id;

      await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`);

      await request(app)
        .post(`/api/plans/${planId}/versions/1/approve`)
        .send({ approver: 'test-user' });

      await request(app)
        .post(`/api/plans/${planId}/versions/1/publish`);

      // Try to update
      const response = await request(app)
        .put(`/api/plans/${planId}`)
        .send({ goal: 'Updated goal' })
        .expect(400);

      expect(response.body.error).toBe('Cannot update approved or published version');
    });

    it('should allow creating new version after approval', async () => {
      // Create, submit, and approve a plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Test goal' });
      const planId = createResponse.body.plan.plan_id;

      await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`);

      await request(app)
        .post(`/api/plans/${planId}/versions/1/approve`)
        .send({ approver: 'test-user' });

      // Create new version should work
      const response = await request(app)
        .post(`/api/plans/${planId}/versions`)
        .send({ goal: 'New version' })
        .expect(201);

      expect(response.body.version.version).toBe(2);
      expect(response.body.version.status).toBe('draft');
    });
  });

  describe('Full workflow', () => {
    it('should complete full lifecycle: draft -> submit -> approve -> publish', async () => {
      // 1. Create plan
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Build feature X' });
      const planId = createResponse.body.plan.plan_id;

      expect(createResponse.body.version.status).toBe('draft');

      // 2. Submit for review
      const submitResponse = await request(app)
        .post(`/api/plans/${planId}/versions/1/submit`);

      expect(submitResponse.body.version.submitted_at).toBeDefined();

      // 3. Approve
      const approveResponse = await request(app)
        .post(`/api/plans/${planId}/versions/1/approve`)
        .send({ approver: 'tech-lead' });

      expect(approveResponse.body.version.status).toBe('approved');
      expect(approveResponse.body.version.approval_info.approver).toBe('tech-lead');

      // 4. Publish
      const publishResponse = await request(app)
        .post(`/api/plans/${planId}/versions/1/publish`);

      expect(publishResponse.body.version.status).toBe('published');
      expect(publishResponse.body.plan_ref).toBe(`${planId}:1`);

      // 5. Verify final state
      const getResponse = await request(app)
        .get(`/api/plans/${planId}/versions/1`);

      expect(getResponse.body.version.status).toBe('published');
      expect(getResponse.body.version.submitted_at).toBeDefined();
      expect(getResponse.body.version.approval_info).toBeDefined();
    });
  });
});
