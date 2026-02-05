/**
 * Change Request Flow Tests (Standalone Mode)
 *
 * Tests change request flow in standalone mode:
 * - Direct application of suggested changes (no revision agent)
 * - Accept/reject revision flows (for externally created drafts)
 *
 * Note: In standalone mode, revision agents are NOT spawned.
 * Changes are applied directly when change requests are created.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/index.js';
import { createStep } from '../domain/step.js';

describe('Change Request Flow Tests (Standalone)', () => {
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
    const createResponse = await request(app)
      .post('/api/plans')
      .send({ goal });
    const planId = createResponse.body.plan.plan_id;

    if (steps.length > 0) {
      await request(app)
        .post(`/api/plans/${planId}/versions`)
        .send({ steps });
    }

    const latestVersion = storage.getLatestVersion(planId);
    const version = latestVersion!.version;

    await request(app)
      .post(`/api/plans/${planId}/versions/${version}/submit`);
    await request(app)
      .post(`/api/plans/${planId}/versions/${version}/approve`)
      .send({ approver: 'test-user' });
    await request(app)
      .post(`/api/plans/${planId}/versions/${version}/publish`);

    return { planId, version };
  }

  describe('Direct Change Application (Standalone Mode)', () => {
    it('should apply changes directly and create new draft version', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      const response = await request(app)
        .post('/api/runs/run-test-1/change-requests')
        .send({
          plan_id: planId,
          reason: 'Add new step directly',
          suggested_changes: {
            add_steps: [createStep('Direct step addition')],
          },
        })
        .expect(201);

      // Response should indicate direct application (no agent)
      expect(response.body.revision_agent_spawned).toBe(false);
      expect(response.body.change_request.status).toBe('applied');
      expect(response.body.change_request.revision_status).toBe('none');
      expect(response.body.new_version).toBeDefined();
      expect(response.body.new_version.status).toBe('draft');
    });

    it('should apply suggested add_steps directly', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      const newStep = createStep('New step to add');
      const response = await request(app)
        .post('/api/runs/run-add-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test add steps',
          suggested_changes: {
            add_steps: [newStep],
          },
        })
        .expect(201);

      expect(response.body.new_version.steps).toHaveLength(1);
      expect(response.body.new_version.steps[0].title).toBe('New step to add');
    });

    it('should apply suggested modify_steps directly', async () => {
      const step1 = createStep('Original title');
      const { planId } = await createAndPublishPlan('Test goal', [step1]);

      const response = await request(app)
        .post('/api/runs/run-modify-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test modify steps',
          suggested_changes: {
            modify_steps: [{ step_id: step1.step_id, title: 'Modified title' }],
          },
        })
        .expect(201);

      expect(response.body.new_version.steps[0].title).toBe('Modified title');
    });

    it('should apply suggested remove_steps directly', async () => {
      const step1 = createStep('Keep this');
      const step2 = createStep('Remove this');
      const { planId } = await createAndPublishPlan('Test goal', [step1, step2]);

      const response = await request(app)
        .post('/api/runs/run-remove-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test remove steps',
          suggested_changes: {
            remove_steps: [step2.step_id],
          },
        })
        .expect(201);

      expect(response.body.new_version.steps).toHaveLength(1);
      expect(response.body.new_version.steps[0].step_id).toBe(step1.step_id);
    });

    it('should link new draft version to change request', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      const response = await request(app)
        .post('/api/runs/run-link-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test linking',
          suggested_changes: {},
        })
        .expect(201);

      expect(response.body.new_version.change_request_id).toBe(
        response.body.change_request.change_request_id
      );
    });

    it('should set change request status to applied with result_version', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      const response = await request(app)
        .post('/api/runs/run-status-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test status',
          suggested_changes: {},
        })
        .expect(201);

      expect(response.body.change_request.status).toBe('applied');
      expect(response.body.change_request.result_version).toBe(response.body.new_version.version);
      expect(response.body.change_request.revision_status).toBe('none');
    });
  });

  describe('Accept/Reject Revision Flows', () => {
    /**
     * Helper to simulate an externally created draft revision.
     * In a real scenario, this would be created by a revision agent via MCP tools.
     */
    function setupDraftedRevision(planId: string, changeRequestId: string, agentId: string) {
      const latestVersion = storage.getLatestVersion(planId);
      const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;
      const now = new Date().toISOString();

      storage.createVersion({
        plan_id: planId,
        version: newVersionNumber,
        status: 'draft' as const,
        summary: { goal: 'Test goal' },
        steps: [createStep('Agent-created step')],
        change_request_id: changeRequestId,
        created_at: now,
        updated_at: now,
      });

      storage.updateChangeRequestRevisionStatus(changeRequestId, agentId, 'drafted');

      return newVersionNumber;
    }

    /**
     * Helper to create a change request with pending status.
     * This simulates a change request waiting for agent revision.
     */
    async function createPendingChangeRequest(planId: string, reason: string) {
      // Create change request directly in storage (simulating relay-integrated server)
      const crId = `cr-${Date.now()}`;
      const now = new Date().toISOString();

      storage.createChangeRequest({
        change_request_id: crId,
        run_id: 'run-test',
        plan_id: planId,
        reason,
        suggested_changes: {},
        status: 'pending' as const,
        revision_status: 'pending' as const,
        revision_session_id: null,
        result_version: null,
        created_at: now,
        updated_at: now,
      });

      return crId;
    }

    it('should accept revision and update change request status', async () => {
      const { planId } = await createAndPublishPlan('Test goal');
      const changeRequestId = await createPendingChangeRequest(planId, 'Test accept');

      // Simulate external agent creating a draft
      const draftVersion = setupDraftedRevision(planId, changeRequestId, 'external-agent');

      // Accept the revision
      const response = await request(app)
        .post(`/api/change-requests/${changeRequestId}/accept-revision`)
        .expect(200);

      expect(response.body.change_request.status).toBe('applied');
      expect(response.body.change_request.revision_status).toBe('none');
      expect(response.body.change_request.result_version).toBe(draftVersion);
      expect(response.body.version.version).toBe(draftVersion);
    });

    it('should reject revision and reset change request status', async () => {
      const { planId } = await createAndPublishPlan('Test goal');
      const changeRequestId = await createPendingChangeRequest(planId, 'Test reject');

      // Simulate external agent creating a draft
      setupDraftedRevision(planId, changeRequestId, 'external-agent');

      // Reject the revision
      const response = await request(app)
        .post(`/api/change-requests/${changeRequestId}/reject-revision`)
        .expect(200);

      expect(response.body.change_request.revision_status).toBe('none');
      // revision_session_id should be cleared (null or undefined)
      expect(response.body.change_request.revision_session_id ?? null).toBeNull();
    });

    it('should return 400 when accepting revision that is not drafted', async () => {
      const { planId } = await createAndPublishPlan('Test goal');
      const changeRequestId = await createPendingChangeRequest(planId, 'Test invalid accept');

      // Don't create draft - leave in pending state

      const response = await request(app)
        .post(`/api/change-requests/${changeRequestId}/accept-revision`)
        .expect(400);

      expect(response.body.error).toContain('Cannot accept revision');
    });

    it('should return 400 when rejecting revision that is not drafted', async () => {
      const { planId } = await createAndPublishPlan('Test goal');
      const changeRequestId = await createPendingChangeRequest(planId, 'Test invalid reject');

      // Don't create draft - leave in pending state

      const response = await request(app)
        .post(`/api/change-requests/${changeRequestId}/reject-revision`)
        .expect(400);

      expect(response.body.error).toContain('Cannot reject revision');
    });

    it('should return 404 for non-existent change request', async () => {
      const response = await request(app)
        .post('/api/change-requests/non-existent-id/accept-revision')
        .expect(404);

      expect(response.body.error).toBe('Change request not found');
    });
  });

  describe('Draft Version Linking', () => {
    it('should allow looking up version by change request', async () => {
      const { planId, version } = await createAndPublishPlan('Test goal');

      // Create a change request (will be auto-applied in standalone mode)
      const crResponse = await request(app)
        .post('/api/runs/run-lookup-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test version lookup',
          suggested_changes: {},
        })
        .expect(201);

      const changeRequestId = crResponse.body.change_request.change_request_id;

      // In standalone mode, version is already created and linked
      const linkedVersion = storage.getVersionByChangeRequest(changeRequestId);
      expect(linkedVersion).toBeDefined();
      expect(linkedVersion?.change_request_id).toBe(changeRequestId);
      expect(linkedVersion?.version).toBe(version + 1);
    });
  });

  describe('Change Request Queries', () => {
    it('should list change requests by run ID', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      await request(app)
        .post('/api/runs/run-query-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'CR 1',
          suggested_changes: {},
        })
        .expect(201);

      await request(app)
        .post('/api/runs/run-query-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'CR 2',
          suggested_changes: {},
        })
        .expect(201);

      const response = await request(app)
        .get('/api/runs/run-query-test/change-requests')
        .expect(200);

      expect(response.body.change_requests).toHaveLength(2);
    });

    it('should list change requests by plan ID', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      await request(app)
        .post('/api/runs/run-a/change-requests')
        .send({
          plan_id: planId,
          reason: 'CR from run A',
          suggested_changes: {},
        })
        .expect(201);

      await request(app)
        .post('/api/runs/run-b/change-requests')
        .send({
          plan_id: planId,
          reason: 'CR from run B',
          suggested_changes: {},
        })
        .expect(201);

      const response = await request(app)
        .get(`/api/plans/${planId}/change-requests`)
        .expect(200);

      expect(response.body.change_requests).toHaveLength(2);
    });
  });
});
