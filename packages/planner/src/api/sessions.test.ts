/**
 * Session API Tests (Standalone Mode)
 *
 * Tests for session endpoints in standalone planner mode (no relay integration).
 * Note: Agent spawning is NOT available in standalone mode - createSession returns 503.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { SqliteStorage } from '../storage/sqlite.js';

describe('Session API Tests (Standalone)', () => {
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
      const response = await request(app)
        .post('/api/plans/non-existent-id/session')
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });

    it('should return 400 when latest version is approved', async () => {
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

    it('should return 503 in standalone mode (no relay integration)', async () => {
      const { plan } = await createDraftPlan('Test plan');

      const response = await request(app)
        .post(`/api/plans/${plan.plan_id}/session`)
        .expect(503);

      expect(response.body.error).toBe('AI service unavailable');
      expect(response.body.message).toContain('standalone mode');
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

    it('should return 404 for non-existent plan', async () => {
      const response = await request(app)
        .get('/api/plans/non-existent/session')
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });

    it('should return session info when session exists in DB', async () => {
      const { plan } = await createDraftPlan('Test plan');

      // Manually create a session in the database (simulating external creation)
      const sessionId = 'test-session-id';
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      storage.createSession({
        session_id: sessionId,
        token: 'test-token-123',
        plan_id: plan.plan_id,
        status: 'active',
        agent_id: 'test-agent-123',
        started_at: now,
        ended_at: null,
        expires_at: expiresAt,
        created_at: now,
      });

      const response = await request(app)
        .get(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      expect(response.body.status).toBe('active');
      expect(response.body.session_id).toBe(sessionId);
      expect(response.body.agent_id).toBe('test-agent-123');
      expect(response.body.started_at).toBeDefined();
    });
  });

  describe('DELETE /api/plans/:id/session', () => {
    it('should terminate session and return success', async () => {
      const { plan } = await createDraftPlan('Test plan');

      // Manually create a session
      const sessionId = 'session-to-terminate';
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      storage.createSession({
        session_id: sessionId,
        token: 'test-token-456',
        plan_id: plan.plan_id,
        status: 'active',
        agent_id: 'agent-to-terminate',
        started_at: now,
        ended_at: null,
        expires_at: expiresAt,
        created_at: now,
      });

      // Terminate session
      const response = await request(app)
        .delete(`/api/plans/${plan.plan_id}/session`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.session_id).toBe(sessionId);

      // Verify session status updated (getSessionByPlanId only returns active sessions)
      const session = storage.getSessionByPlanId(plan.plan_id);
      expect(session).toBeNull();
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
