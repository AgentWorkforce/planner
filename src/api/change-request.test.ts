import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';
import { createStep } from '../domain/step.js';

describe('Change Request API Integration Tests', () => {
  let storage: SqliteStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    storage = new SqliteStorage(':memory:');
    app = createApp(storage);
  });

  afterEach(() => {
    storage.close();
  });

  /**
   * Helper to create and publish a plan.
   */
  async function createAndPublishPlan(goal: string, steps: ReturnType<typeof createStep>[] = []) {
    // Create plan
    const createResponse = await request(app)
      .post('/api/plans')
      .send({ goal });
    const planId = createResponse.body.plan.plan_id;

    // Add steps if provided
    if (steps.length > 0) {
      await request(app)
        .post(`/api/plans/${planId}/versions`)
        .send({ steps });
    }

    // Get the latest version number
    const latestVersion = storage.getLatestVersion(planId);
    const version = latestVersion!.version;

    // Submit
    await request(app)
      .post(`/api/plans/${planId}/versions/${version}/submit`);

    // Approve
    await request(app)
      .post(`/api/plans/${planId}/versions/${version}/approve`)
      .send({ approver: 'test-user' });

    // Publish
    await request(app)
      .post(`/api/plans/${planId}/versions/${version}/publish`);

    return { planId, version };
  }

  describe('POST /runs/:run_id/change-requests', () => {
    it('should create change request and new draft version', async () => {
      const { planId } = await createAndPublishPlan('Original goal');

      const response = await request(app)
        .post('/api/runs/run-123/change-requests')
        .send({
          plan_id: planId,
          reason: 'Need to add a new step',
          suggested_changes: {
            add_steps: [createStep('New step from change request')],
          },
        })
        .expect(201);

      expect(response.body.change_request).toBeDefined();
      expect(response.body.change_request.run_id).toBe('run-123');
      expect(response.body.change_request.plan_id).toBe(planId);
      expect(response.body.change_request.reason).toBe('Need to add a new step');
      expect(response.body.change_request.status).toBe('applied');
      expect(response.body.change_request.result_version).toBe(2);

      expect(response.body.new_version).toBeDefined();
      expect(response.body.new_version.version).toBe(2);
      expect(response.body.new_version.status).toBe('draft');
      expect(response.body.new_version.change_request_id).toBe(
        response.body.change_request.change_request_id
      );
      expect(response.body.new_version.steps).toHaveLength(1);
      expect(response.body.new_version.steps[0]!.title).toBe('New step from change request');
    });

    it('should apply step modifications', async () => {
      const step1 = createStep('Step 1');
      const step2 = createStep('Step 2');
      const { planId } = await createAndPublishPlan('Goal with steps', [step1, step2]);

      const response = await request(app)
        .post('/api/runs/run-456/change-requests')
        .send({
          plan_id: planId,
          reason: 'Update step title',
          suggested_changes: {
            modify_steps: [{ step_id: step1.step_id, title: 'Updated Step 1' }],
          },
        })
        .expect(201);

      expect(response.body.new_version.steps).toHaveLength(2);
      expect(response.body.new_version.steps[0]!.title).toBe('Updated Step 1');
      expect(response.body.new_version.steps[1]!.title).toBe('Step 2');
    });

    it('should remove steps', async () => {
      const step1 = createStep('Step 1');
      const step2 = createStep('Step 2');
      const step3 = createStep('Step 3');
      const { planId } = await createAndPublishPlan('Goal', [step1, step2, step3]);

      const response = await request(app)
        .post('/api/runs/run-789/change-requests')
        .send({
          plan_id: planId,
          reason: 'Remove middle step',
          suggested_changes: {
            remove_steps: [step2.step_id],
          },
        })
        .expect(201);

      expect(response.body.new_version.steps).toHaveLength(2);
      expect(response.body.new_version.steps[0]!.step_id).toBe(step1.step_id);
      expect(response.body.new_version.steps[1]!.step_id).toBe(step3.step_id);
    });

    it('should keep original published version unchanged', async () => {
      const step1 = createStep('Original Step');
      const { planId, version: originalVersion } = await createAndPublishPlan('Goal', [step1]);

      await request(app)
        .post('/api/runs/run-abc/change-requests')
        .send({
          plan_id: planId,
          reason: 'Add another step',
          suggested_changes: {
            add_steps: [createStep('New Step')],
          },
        })
        .expect(201);

      // Verify original version is unchanged
      const originalVersionResponse = await request(app)
        .get(`/api/plans/${planId}/versions/${originalVersion}`)
        .expect(200);

      expect(originalVersionResponse.body.version.status).toBe('published');
      expect(originalVersionResponse.body.version.steps).toHaveLength(1);
      expect(originalVersionResponse.body.version.steps[0]!.title).toBe('Original Step');
    });

    it('should return 400 if no published version exists', async () => {
      // Create plan without publishing
      const createResponse = await request(app)
        .post('/api/plans')
        .send({ goal: 'Unpublished goal' });
      const planId = createResponse.body.plan.plan_id;

      const response = await request(app)
        .post('/api/runs/run-xyz/change-requests')
        .send({
          plan_id: planId,
          reason: 'Try to change unpublished plan',
          suggested_changes: {},
        })
        .expect(400);

      expect(response.body.error).toBe('No published version found to base changes on');
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .post('/api/runs/run-xyz/change-requests')
        .send({
          plan_id: '00000000-0000-0000-0000-000000000000',
          reason: 'Change request for missing plan',
          suggested_changes: {},
        })
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });

    it('should return 400 if reason is missing', async () => {
      const { planId } = await createAndPublishPlan('Goal');

      const response = await request(app)
        .post('/api/runs/run-xyz/change-requests')
        .send({
          plan_id: planId,
          suggested_changes: {},
        })
        .expect(400);

      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /runs/:run_id/change-requests', () => {
    it('should list change requests for a run', async () => {
      const { planId } = await createAndPublishPlan('Goal');

      // Create two change requests for same run
      await request(app)
        .post('/api/runs/run-list-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'First change',
          suggested_changes: { add_steps: [createStep('Step 1')] },
        });

      // Need to publish again before second change request
      const versions = storage.listVersions(planId);
      const latestDraft = versions.find((v) => v.status === 'draft');
      if (latestDraft) {
        await request(app)
          .post(`/api/plans/${planId}/versions/${latestDraft.version}/submit`);
        await request(app)
          .post(`/api/plans/${planId}/versions/${latestDraft.version}/approve`)
          .send({ approver: 'test-user' });
        await request(app)
          .post(`/api/plans/${planId}/versions/${latestDraft.version}/publish`);
      }

      await request(app)
        .post('/api/runs/run-list-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'Second change',
          suggested_changes: { add_steps: [createStep('Step 2')] },
        });

      const response = await request(app)
        .get('/api/runs/run-list-test/change-requests')
        .expect(200);

      expect(response.body.change_requests).toHaveLength(2);
      expect(response.body.change_requests[0]!.linked_version).toBeDefined();
    });

    it('should return empty array for run with no change requests', async () => {
      const response = await request(app)
        .get('/api/runs/no-such-run/change-requests')
        .expect(200);

      expect(response.body.change_requests).toEqual([]);
    });
  });

  describe('GET /plans/:id/change-requests', () => {
    it('should list change requests for a plan', async () => {
      const { planId } = await createAndPublishPlan('Goal');

      await request(app)
        .post('/api/runs/run-a/change-requests')
        .send({
          plan_id: planId,
          reason: 'Change from run A',
          suggested_changes: {},
        });

      const response = await request(app)
        .get(`/api/plans/${planId}/change-requests`)
        .expect(200);

      expect(response.body.change_requests).toHaveLength(1);
      expect(response.body.change_requests[0]!.reason).toBe('Change from run A');
      expect(response.body.change_requests[0]!.linked_version).toBeDefined();
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/plans/00000000-0000-0000-0000-000000000000/change-requests')
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });
  });

  describe('Version traceability', () => {
    it('should link version to change request', async () => {
      const { planId } = await createAndPublishPlan('Goal');

      const createResponse = await request(app)
        .post('/api/runs/run-trace/change-requests')
        .send({
          plan_id: planId,
          reason: 'Trace test',
          suggested_changes: {},
        })
        .expect(201);

      const changeRequestId = createResponse.body.change_request.change_request_id;
      const newVersionNumber = createResponse.body.new_version.version;

      // Verify version has change_request_id
      const versionResponse = await request(app)
        .get(`/api/plans/${planId}/versions/${newVersionNumber}`)
        .expect(200);

      expect(versionResponse.body.version.change_request_id).toBe(changeRequestId);
    });
  });
});
