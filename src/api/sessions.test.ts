/**
 * Session API Tests
 *
 * Tests for POST /plans/:id/session endpoint (create session for existing plan).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';
import { PlanStatus } from '../domain/status.js';

// Mock the relay service and spawner modules
vi.mock('../relay/service.js', () => ({
  isRelayAvailable: vi.fn(),
}));

vi.mock('../relay/spawner.js', () => ({
  spawnPlanningAgent: vi.fn(),
  terminateAgent: vi.fn(),
  spawnRevisionAgent: vi.fn(),
  createSpawner: vi.fn(() => ({
    spawn: vi.fn().mockResolvedValue({
      agentId: 'mock-agent',
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
import { spawnPlanningAgent, terminateAgent } from '../relay/spawner.js';

describe('Session API Tests', () => {
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
   * Helper to create a plan with a draft version.
   */
  async function createDraftPlan(goal: string) {
    const createResponse = await request(app)
      .post('/api/plans')
      .send({ goal });
    return createResponse.body;
  }

  describe('POST /api/plans/:id/session', () => {
    it('should return 404 for non-existent plan_id', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);

      const response = await request(app)
        .post('/api/plans/non-existent-id/session')
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });

    it('should return 409 when plan already has active session', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnPlanningAgent).mockResolvedValue({
        agentId: 'test-agent',
        sessionToken: 'test-token',
        isMock: false,
      });

      const { plan } = await createDraftPlan('Test plan');

      // First session creation should succeed
      await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      // Second attempt should return 409
      const response = await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(409);

      expect(response.body.error).toBe('Session already exists');
      expect(response.body.session_id).toBeDefined();
      expect(response.body.agent_id).toBe('test-agent');
      expect(response.body.started_at).toBeDefined();
    });

    it('should return 400 when latest version is approved', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);

      const { plan, version } = await createDraftPlan('Test plan');

      // Approve the plan
      await request(app)
        .post(`/api/plans/${plan.plan_id}/versions/${version.version}/submit`);
      await request(app)
        .post(`/api/plans/${plan.plan_id}/versions/${version.version}/approve`)
        .send({ approver: 'test-user', comments: 'LGTM' });

      const response = await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(400);

      expect(response.body.error).toBe('Only draft plans can have AI sessions');
    });

    it('should return 400 when latest version is published', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);

      const { plan, version } = await createDraftPlan('Test plan');

      // Approve and publish the plan
      await request(app)
        .post(`/api/plans/${plan.plan_id}/versions/${version.version}/submit`);
      await request(app)
        .post(`/api/plans/${plan.plan_id}/versions/${version.version}/approve`)
        .send({ approver: 'test-user', comments: 'LGTM' });
      await request(app)
        .post(`/api/plans/${plan.plan_id}/versions/${version.version}/publish`);

      const response = await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(400);

      expect(response.body.error).toBe('Only draft plans can have AI sessions');
    });

    it('should return 503 when relay is not available', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(false);

      const { plan } = await createDraftPlan('Test plan');

      const response = await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(503);

      expect(response.body.error).toBe('AI service unavailable');
    });

    it('should create session and spawn agent on success', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnPlanningAgent).mockResolvedValue({
        agentId: 'planning-agent-123',
        sessionToken: 'token-abc',
        isMock: false,
      });

      const { plan } = await createDraftPlan('Build a widget');

      const response = await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      expect(response.body.session_id).toBeDefined();
      expect(response.body.status).toBe('active');
      expect(response.body.agent_id).toBe('planning-agent-123');
      expect(response.body.started_at).toBeDefined();

      // Verify session was stored
      const session = storage.getSessionByPlanId(plan.plan_id);
      expect(session).not.toBeNull();
      expect(session!.agent_id).toBe('planning-agent-123');
      expect(session!.status).toBe('active');
    });

    it('should spawn agent with existingStepCount from plan', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnPlanningAgent).mockResolvedValue({
        agentId: 'planning-agent-456',
        sessionToken: 'token-def',
        isMock: false,
      });

      // Create plan with steps
      const { plan, version } = await createDraftPlan('Build a widget');

      // Add some steps
      await request(app)
        .post(`/api/plans/${plan.plan_id}/versions`)
        .send({
          steps: [
            { step_id: 's1', title: 'Step 1', dependencies: [] },
            { step_id: 's2', title: 'Step 2', dependencies: ['s1'] },
            { step_id: 's3', title: 'Step 3', dependencies: ['s1'] },
          ],
        });

      await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      // Verify spawnPlanningAgent was called with correct context
      expect(spawnPlanningAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: plan.plan_id,
          existingStepCount: 3,
        })
      );
    });

    it('should extract goal from latest version summary', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnPlanningAgent).mockResolvedValue({
        agentId: 'planning-agent-789',
        sessionToken: 'token-ghi',
        isMock: false,
      });

      const { plan } = await createDraftPlan('Original goal');

      await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      // Verify goal was passed to spawner
      expect(spawnPlanningAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          goal: 'Original goal',
        })
      );
    });

    it('should return valid ISO timestamp for started_at', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnPlanningAgent).mockResolvedValue({
        agentId: 'agent-1',
        sessionToken: 'token-1',
        isMock: false,
      });

      const { plan } = await createDraftPlan('Test plan');

      const response = await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      // Verify started_at is a valid ISO timestamp
      const parsedDate = new Date(response.body.started_at);
      expect(parsedDate.toISOString()).toBe(response.body.started_at);
    });

    it('should not create session if spawn fails', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnPlanningAgent).mockRejectedValue(new Error('Spawn failed'));

      const { plan } = await createDraftPlan('Test plan');

      await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(500);

      // Verify no session was created
      const session = storage.getSessionByPlanId(plan.plan_id);
      expect(session).toBeNull();
    });
  });

  describe('GET /api/plans/:id/session', () => {
    it('should return { status: none } when no session exists', async () => {
      const { plan } = await createDraftPlan('Test plan');

      const response = await request(app)
        .get(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      expect(response.body.status).toBe('none');
    });

    it('should return session info when session exists', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnPlanningAgent).mockResolvedValue({
        agentId: 'agent-123',
        sessionToken: 'token-abc',
        isMock: false,
      });

      const { plan } = await createDraftPlan('Test plan');

      // Create session
      await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      const response = await request(app)
        .get(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      expect(response.body.status).toBe('active');
      expect(response.body.session_id).toBeDefined();
      expect(response.body.agent_id).toBe('agent-123');
      expect(response.body.started_at).toBeDefined();
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/plans/non-existent/session')
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });
  });

  describe('DELETE /api/plans/:id/session', () => {
    it('should terminate session and return success', async () => {
      vi.mocked(isRelayAvailable).mockReturnValue(true);
      vi.mocked(spawnPlanningAgent).mockResolvedValue({
        agentId: 'agent-to-terminate',
        sessionToken: 'token-xyz',
        isMock: false,
      });

      const { plan } = await createDraftPlan('Test plan');

      // Create session
      const createResponse = await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      // Terminate session
      const response = await request(app)
        .delete(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.session_id).toBe(createResponse.body.session_id);

      // Verify terminateAgent was called
      expect(terminateAgent).toHaveBeenCalledWith('agent-to-terminate');

      // Verify session status updated
      const session = storage.getSessionByPlanId(plan.plan_id);
      expect(session).toBeNull(); // getSessionByPlanId only returns active sessions
    });

    it('should return 404 when no active session exists', async () => {
      const { plan } = await createDraftPlan('Test plan');

      const response = await request(app)
        .delete(`/api/plans/${plan.plan_id}/session`)
        .expect(404);

      expect(response.body.error).toBe('Active session not found');
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .delete('/api/plans/non-existent/session')
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });
  });
});
