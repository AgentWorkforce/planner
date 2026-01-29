/**
 * Change Request Agent Flow Integration Tests
 *
 * Tests the full change request → revision agent → draft creation → accept/reject flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';
import { createStep } from '../domain/step.js';

// Mock the relay service and spawner modules
vi.mock('../relay/service.js', () => ({
  isRelayAvailable: vi.fn(),
}));

vi.mock('../relay/spawner.js', () => ({
  spawnRevisionAgent: vi.fn(),
  spawnPlanningAgent: vi.fn().mockResolvedValue({
    agentId: 'mock-planning-agent',
    sessionToken: 'mock-session-token',
    isMock: true,
  }),
  terminateAgent: vi.fn(),
  createSpawner: vi.fn(() => ({
    spawn: vi.fn().mockResolvedValue({
      agentId: 'mock-agent',
      sessionToken: 'mock-token',
      isMock: true,
    }),
    spawnRevision: vi.fn().mockResolvedValue({
      agentId: 'mock-reviser',
      sessionToken: 'mock-token',
      isMock: true,
    }),
    terminate: vi.fn(),
  })),
  getPlanningAgentPrompt: vi.fn(() => 'Mock planning prompt'),
  getRevisionAgentPrompt: vi.fn(() => 'Mock revision prompt'),
}));

vi.mock('../relay/mock-spawner.js', () => ({
  createMockSpawner: vi.fn(() => ({
    spawn: vi.fn().mockResolvedValue({
      agentId: 'mock-spawner-agent',
      sessionToken: 'mock-spawner-token',
      isMock: true,
    }),
    terminate: vi.fn(),
  })),
}));

vi.mock('../relay/config.js', () => ({
  getRelayConfig: vi.fn(() => ({
    socketPath: '/tmp/test-relay.sock',
    reconnectInterval: 5000,
    maxReconnectAttempts: 0,
    maxReconnectDelay: 30000,
    mcpServerUrl: 'http://localhost:3001/api/mcp',
  })),
}));

import { isRelayAvailable } from '../relay/service.js';
import { spawnRevisionAgent, terminateAgent } from '../relay/spawner.js';

describe('Change Request Agent Flow Integration Tests', () => {
  let storage: SqliteStorage;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('Revision Agent Spawning', () => {
    it('should spawn revision agent when relay is available', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      // Mock relay as available
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnRevisionAgent).mockResolvedValue({
        agentId: 'Reviser-test1234',
        sessionToken: 'session-abc123',
        isMock: false,
      });

      const response = await request(app)
        .post('/api/runs/run-spawn-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'Need to add error handling',
          suggested_changes: {
            add_steps: [createStep('Add error handling middleware')],
          },
        })
        .expect(201);

      // Verify revision agent was spawned
      expect(spawnRevisionAgent).toHaveBeenCalledTimes(1);
      expect(spawnRevisionAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          planId,
          currentVersion: 1,
          changeRequest: expect.objectContaining({
            reason: 'Need to add error handling',
          }),
          mcpServerUrl: 'http://localhost:3001/api/mcp',
        })
      );

      // Response should indicate agent was spawned
      expect(response.body.revision_agent_spawned).toBe(true);
      expect(response.body.change_request).toBeDefined();
      expect(response.body.change_request.revision_status).toBe('pending');
      expect(response.body.change_request.revision_session_id).toBe('Reviser-test1234');
    });

    it('should fall back to direct changes when relay is unavailable', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      // Mock relay as unavailable
      vi.mocked(isRelayAvailable).mockReturnValue(false);

      const response = await request(app)
        .post('/api/runs/run-fallback-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'Add new step directly',
          suggested_changes: {
            add_steps: [createStep('Direct step addition')],
          },
        })
        .expect(201);

      // Revision agent should NOT have been spawned
      expect(spawnRevisionAgent).not.toHaveBeenCalled();

      // Response should indicate direct application
      expect(response.body.revision_agent_spawned).toBe(false);
      expect(response.body.change_request.status).toBe('applied');
      expect(response.body.change_request.revision_status).toBe('none');
      expect(response.body.new_version).toBeDefined();
      expect(response.body.new_version.status).toBe('draft');
    });

    it('should fall back to direct changes when spawn fails', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      // Mock relay as available but spawn fails
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnRevisionAgent).mockRejectedValue(new Error('Spawn failed'));

      const response = await request(app)
        .post('/api/runs/run-spawn-error/change-requests')
        .send({
          plan_id: planId,
          reason: 'Add step with spawn error',
          suggested_changes: {
            add_steps: [createStep('New step after error')],
          },
        })
        .expect(201);

      // Should fall back to direct application
      expect(response.body.revision_agent_spawned).toBe(false);
      expect(response.body.change_request.status).toBe('applied');
      expect(response.body.new_version).toBeDefined();
    });

    it('should pass change request context to revision agent', async () => {
      const step1 = createStep('Existing step');
      const { planId, version: publishedVersion } = await createAndPublishPlan('Test goal', [step1]);

      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnRevisionAgent).mockResolvedValue({
        agentId: 'Reviser-context',
        sessionToken: 'session-ctx123',
        isMock: false,
      });

      await request(app)
        .post('/api/runs/run-context/change-requests')
        .send({
          plan_id: planId,
          reason: 'Fix dependency issue',
          suggested_changes: {
            modify_steps: [{ step_id: step1.step_id, title: 'Updated step title' }],
          },
        })
        .expect(201);

      // Verify full context was passed
      expect(spawnRevisionAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          planId,
          currentVersion: publishedVersion,
          changeRequest: expect.objectContaining({
            reason: 'Fix dependency issue',
            suggested_changes: expect.objectContaining({
              modify_steps: expect.arrayContaining([
                expect.objectContaining({
                  step_id: step1.step_id,
                  title: 'Updated step title',
                }),
              ]),
            }),
          }),
        })
      );
    });
  });

  describe('Draft Version Linking', () => {
    it('should link draft version to change request via create_draft_version MCP tool', async () => {
      const { planId, version } = await createAndPublishPlan('Test goal', [createStep('Original step')]);

      // Create a change request manually (simulating agent flow)
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnRevisionAgent).mockResolvedValue({
        agentId: 'Reviser-link-test',
        sessionToken: 'session-link',
        isMock: false,
      });

      const crResponse = await request(app)
        .post('/api/runs/run-link-test/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test linking',
          suggested_changes: {},
        })
        .expect(201);

      const changeRequestId = crResponse.body.change_request.change_request_id;

      // Simulate agent using create_draft_version MCP tool
      // The tool creates a draft version linked to the change request
      const now = new Date().toISOString();
      const newVersionNumber = version + 1;
      storage.createVersion({
        plan_id: planId,
        version: newVersionNumber,
        status: 'draft' as const,
        summary: { goal: 'Test goal' },
        steps: [createStep('Step from revision agent')],
        change_request_id: changeRequestId,
        created_at: now,
        updated_at: now,
      });

      // Update change request to 'drafted' status
      storage.updateChangeRequestRevisionStatus(changeRequestId, null, 'drafted');

      // Verify linking
      const version2 = storage.getVersion(planId, newVersionNumber);
      expect(version2?.change_request_id).toBe(changeRequestId);

      // Verify change request status
      const cr = storage.getChangeRequest(changeRequestId);
      expect(cr?.revision_status).toBe('drafted');
    });

    it('should allow looking up version by change request', async () => {
      const { planId, version } = await createAndPublishPlan('Test goal');

      // Create a change request
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnRevisionAgent).mockResolvedValue({
        agentId: 'Reviser-lookup',
        sessionToken: 'session-lookup',
        isMock: false,
      });

      const crResponse = await request(app)
        .post('/api/runs/run-lookup/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test version lookup',
          suggested_changes: {},
        })
        .expect(201);

      const changeRequestId = crResponse.body.change_request.change_request_id;

      // Simulate agent creating draft
      const now = new Date().toISOString();
      const newVersionNumber = version + 1;
      storage.createVersion({
        plan_id: planId,
        version: newVersionNumber,
        status: 'draft' as const,
        summary: { goal: 'Test goal' },
        steps: [createStep('Agent step')],
        change_request_id: changeRequestId,
        created_at: now,
        updated_at: now,
      });

      // Verify we can look up version by change request
      const linkedVersion = storage.getVersionByChangeRequest(changeRequestId);
      expect(linkedVersion).toBeDefined();
      expect(linkedVersion?.change_request_id).toBe(changeRequestId);
      expect(linkedVersion?.version).toBe(newVersionNumber);
    });
  });

  describe('Accept/Reject Revision Flows', () => {
    async function setupDraftedRevision(planId: string, changeRequestId: string, agentId: string) {
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

    it('should terminate agent when accepting revision', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnRevisionAgent).mockResolvedValue({
        agentId: 'Reviser-accept',
        sessionToken: 'session-accept',
        isMock: false,
      });
      vi.mocked(terminateAgent).mockResolvedValue(undefined);

      const crResponse = await request(app)
        .post('/api/runs/run-accept/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test accept',
          suggested_changes: {},
        })
        .expect(201);

      const changeRequestId = crResponse.body.change_request.change_request_id;

      // Setup drafted revision
      await setupDraftedRevision(planId, changeRequestId, 'Reviser-accept');

      // Accept the revision
      await request(app)
        .post(`/api/change-requests/${changeRequestId}/accept-revision`)
        .expect(200);

      // Verify agent was terminated
      expect(terminateAgent).toHaveBeenCalledWith('Reviser-accept');
    });

    it('should terminate agent when rejecting revision', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnRevisionAgent).mockResolvedValue({
        agentId: 'Reviser-reject',
        sessionToken: 'session-reject',
        isMock: false,
      });
      vi.mocked(terminateAgent).mockResolvedValue(undefined);

      const crResponse = await request(app)
        .post('/api/runs/run-reject/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test reject',
          suggested_changes: {},
        })
        .expect(201);

      const changeRequestId = crResponse.body.change_request.change_request_id;

      // Setup drafted revision
      await setupDraftedRevision(planId, changeRequestId, 'Reviser-reject');

      // Reject the revision
      await request(app)
        .post(`/api/change-requests/${changeRequestId}/reject-revision`)
        .expect(200);

      // Verify agent was terminated
      expect(terminateAgent).toHaveBeenCalledWith('Reviser-reject');
    });

    it('should handle termination failure gracefully during accept', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnRevisionAgent).mockResolvedValue({
        agentId: 'Reviser-term-fail',
        sessionToken: 'session-fail',
        isMock: false,
      });
      vi.mocked(terminateAgent).mockRejectedValue(new Error('Termination failed'));

      const crResponse = await request(app)
        .post('/api/runs/run-term-fail/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test termination failure',
          suggested_changes: {},
        })
        .expect(201);

      const changeRequestId = crResponse.body.change_request.change_request_id;

      // Setup drafted revision
      await setupDraftedRevision(planId, changeRequestId, 'Reviser-term-fail');

      // Accept should still succeed despite termination failure
      const response = await request(app)
        .post(`/api/change-requests/${changeRequestId}/accept-revision`)
        .expect(200);

      expect(response.body.change_request.status).toBe('applied');
    });

    it('should update change request status correctly on accept', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnRevisionAgent).mockResolvedValue({
        agentId: 'Reviser-status',
        sessionToken: 'session-status',
        isMock: false,
      });
      vi.mocked(terminateAgent).mockResolvedValue(undefined);

      const crResponse = await request(app)
        .post('/api/runs/run-status/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test status update',
          suggested_changes: {},
        })
        .expect(201);

      const changeRequestId = crResponse.body.change_request.change_request_id;
      const draftVersion = await setupDraftedRevision(planId, changeRequestId, 'Reviser-status');

      const acceptResponse = await request(app)
        .post(`/api/change-requests/${changeRequestId}/accept-revision`)
        .expect(200);

      expect(acceptResponse.body.change_request.status).toBe('applied');
      expect(acceptResponse.body.change_request.revision_status).toBe('none');
      expect(acceptResponse.body.change_request.result_version).toBe(draftVersion);
      expect(acceptResponse.body.version.version).toBe(draftVersion);
    });

    it('should reset change request status on reject', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnRevisionAgent).mockResolvedValue({
        agentId: 'Reviser-reset',
        sessionToken: 'session-reset',
        isMock: false,
      });
      vi.mocked(terminateAgent).mockResolvedValue(undefined);

      const crResponse = await request(app)
        .post('/api/runs/run-reset/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test status reset',
          suggested_changes: {},
        })
        .expect(201);

      const changeRequestId = crResponse.body.change_request.change_request_id;
      await setupDraftedRevision(planId, changeRequestId, 'Reviser-reset');

      const rejectResponse = await request(app)
        .post(`/api/change-requests/${changeRequestId}/reject-revision`)
        .expect(200);

      expect(rejectResponse.body.change_request.revision_status).toBe('none');
      // revision_session_id should be cleared (null or undefined)
      expect(rejectResponse.body.change_request.revision_session_id ?? null).toBeNull();
    });
  });

  describe('Fallback When Relay Unavailable', () => {
    it('should apply suggested add_steps directly', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      vi.mocked(isRelayAvailable).mockReturnValue(false);

      const newStep = createStep('Fallback step addition');
      const response = await request(app)
        .post('/api/runs/run-fb-add/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test fallback add',
          suggested_changes: {
            add_steps: [newStep],
          },
        })
        .expect(201);

      expect(response.body.new_version.steps).toHaveLength(1);
      expect(response.body.new_version.steps[0].title).toBe('Fallback step addition');
    });

    it('should apply suggested modify_steps directly', async () => {
      const step1 = createStep('Original title');
      const { planId } = await createAndPublishPlan('Test goal', [step1]);

      vi.mocked(isRelayAvailable).mockReturnValue(false);

      const response = await request(app)
        .post('/api/runs/run-fb-modify/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test fallback modify',
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

      vi.mocked(isRelayAvailable).mockReturnValue(false);

      const response = await request(app)
        .post('/api/runs/run-fb-remove/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test fallback remove',
          suggested_changes: {
            remove_steps: [step2.step_id],
          },
        })
        .expect(201);

      expect(response.body.new_version.steps).toHaveLength(1);
      expect(response.body.new_version.steps[0].step_id).toBe(step1.step_id);
    });

    it('should create new draft version with change_request_id', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      vi.mocked(isRelayAvailable).mockReturnValue(false);

      const response = await request(app)
        .post('/api/runs/run-fb-link/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test fallback linking',
          suggested_changes: {},
        })
        .expect(201);

      expect(response.body.new_version.change_request_id).toBe(
        response.body.change_request.change_request_id
      );
    });

    it('should set change request status to applied with result_version', async () => {
      const { planId } = await createAndPublishPlan('Test goal');

      vi.mocked(isRelayAvailable).mockReturnValue(false);

      const response = await request(app)
        .post('/api/runs/run-fb-status/change-requests')
        .send({
          plan_id: planId,
          reason: 'Test fallback status',
          suggested_changes: {},
        })
        .expect(201);

      expect(response.body.change_request.status).toBe('applied');
      expect(response.body.change_request.result_version).toBe(response.body.new_version.version);
      expect(response.body.change_request.revision_status).toBe('none');
    });
  });
});
