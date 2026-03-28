import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkSessionTimeouts, createSessionTimeoutService } from './session-timeout.js';
import type { PlanStorage, Session, SessionStatus } from '../../../planner/src/storage/interface.js';

// Mock the spawner module
vi.mock('./spawner.js', () => ({
  terminateAgent: vi.fn().mockResolvedValue(undefined),
}));

import { terminateAgent } from './spawner.js';

describe('session-timeout', () => {
  // Create mock storage
  function createMockStorage(): PlanStorage & {
    sessions: Session[];
    updatedSessions: { sessionId: string; status: SessionStatus }[];
  } {
    const sessions: Session[] = [];
    const updatedSessions: { sessionId: string; status: SessionStatus }[] = [];

    return {
      sessions,
      updatedSessions,
      getActiveSessions: () => sessions.filter((s) => s.status === 'active'),
      updateSessionStatus: (sessionId: string, status: SessionStatus) => {
        const session = sessions.find((s) => s.session_id === sessionId);
        if (session) {
          session.status = status;
          session.ended_at = new Date().toISOString();
          updatedSessions.push({ sessionId, status });
          return session;
        }
        return null;
      },
      // Stub other methods
      createPlan: () => ({ plan_id: '', name: '', created_at: '', updated_at: '' }),
      getPlan: () => null,
      listPlans: () => [],
      updatePlan: () => null,
      deletePlan: () => false,
      createVersion: () => ({
        plan_id: '',
        version: 1,
        status: 'draft' as const,
        summary: { goal: '' },
        steps: [],
        created_at: '',
        updated_at: '',
      }),
      getLatestVersion: () => null,
      getVersion: () => null,
      listVersions: () => [],
      updateVersion: () => null,
      createStep: () => ({ plan_id: '', version: 1, step_id: '', title: '', order_index: 0 }),
      getStep: () => null,
      getStepsByVersion: () => [],
      updateStep: () => null,
      deleteStep: () => false,
      createSession: () => ({
        session_id: '',
        token: '',
        plan_id: '',
        agent_id: '',
        status: 'active' as const,
        started_at: '',
        ended_at: null,
        expires_at: '',
        created_at: '',
      }),
      getSessionByToken: () => null,
      getSessionByPlanId: () => null,
      createChangeRequest: () => ({
        change_request_id: '',
        run_id: '',
        plan_id: '',
        original_version: 1,
        suggested_version: null,
        status: 'pending' as const,
        source: 'orchestrator' as const,
        changes: [],
        reason: '',
        created_at: '',
        updated_at: '',
      }),
      getChangeRequest: () => null,
      listChangeRequests: () => [],
      listChangeRequestsByPlan: () => [],
      updateChangeRequest: () => null,
      createComment: () => ({
        comment_id: '',
        plan_id: '',
        version: 1,
        author: '',
        body: '',
        status: 'open' as const,
        created_at: '',
        updated_at: '',
      }),
      getComment: () => null,
      listCommentsByVersion: () => [],
      listCommentsByStep: () => [],
      updateComment: () => null,
      deleteComment: () => false,
    } as unknown as PlanStorage & {
      sessions: Session[];
      updatedSessions: { sessionId: string; status: SessionStatus }[];
    };
  }

  function createSession(minutesAgo: number): Session {
    const startTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    return {
      session_id: `session-${Math.random().toString(36).slice(2)}`,
      token: `token-${Math.random().toString(36).slice(2)}`,
      plan_id: `plan-${Math.random().toString(36).slice(2)}`,
      agent_id: `agent-${Math.random().toString(36).slice(2)}`,
      status: 'active' as const,
      started_at: startTime.toISOString(),
      ended_at: null,
      expires_at: new Date(startTime.getTime() + 60 * 60 * 1000).toISOString(),
      created_at: startTime.toISOString(),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete process.env.SESSION_TIMEOUT_MINUTES;
  });

  describe('checkSessionTimeouts', () => {
    it('does nothing when no sessions exist', async () => {
      const storage = createMockStorage();

      const timedOutCount = await checkSessionTimeouts(storage);

      expect(timedOutCount).toBe(0);
      expect(terminateAgent).not.toHaveBeenCalled();
    });

    it('does not timeout sessions within timeout window', async () => {
      const storage = createMockStorage();
      // Session started 5 minutes ago (default timeout is 30 min)
      storage.sessions.push(createSession(5));

      const timedOutCount = await checkSessionTimeouts(storage);

      expect(timedOutCount).toBe(0);
      expect(storage.updatedSessions).toHaveLength(0);
      expect(terminateAgent).not.toHaveBeenCalled();
    });

    it('times out sessions beyond timeout window', async () => {
      const storage = createMockStorage();
      // Session started 31 minutes ago (default timeout is 30 min)
      const session = createSession(31);
      storage.sessions.push(session);

      const timedOutCount = await checkSessionTimeouts(storage);

      expect(timedOutCount).toBe(1);
      expect(storage.updatedSessions).toHaveLength(1);
      expect(storage.updatedSessions[0]?.sessionId).toBe(session.session_id);
      expect(storage.updatedSessions[0]?.status).toBe('timeout');
      expect(terminateAgent).toHaveBeenCalledWith(session.agent_id);
    });

    it('respects SESSION_TIMEOUT_MINUTES env var', async () => {
      process.env.SESSION_TIMEOUT_MINUTES = '10';
      const storage = createMockStorage();
      // Session started 15 minutes ago (custom timeout is 10 min)
      const session = createSession(15);
      storage.sessions.push(session);

      const timedOutCount = await checkSessionTimeouts(storage);

      expect(timedOutCount).toBe(1);
      expect(terminateAgent).toHaveBeenCalledWith(session.agent_id);
    });

    it('handles multiple sessions', async () => {
      const storage = createMockStorage();
      const oldSession = createSession(35); // Should timeout
      const newSession = createSession(5); // Should not timeout
      storage.sessions.push(oldSession, newSession);

      const timedOutCount = await checkSessionTimeouts(storage);

      expect(timedOutCount).toBe(1);
      expect(storage.updatedSessions).toHaveLength(1);
      expect(storage.updatedSessions[0]?.sessionId).toBe(oldSession.session_id);
    });

    it('continues if agent termination fails', async () => {
      vi.mocked(terminateAgent).mockRejectedValueOnce(new Error('Agent not found'));
      const storage = createMockStorage();
      const session = createSession(31);
      storage.sessions.push(session);

      const timedOutCount = await checkSessionTimeouts(storage);

      expect(timedOutCount).toBe(1);
      expect(storage.updatedSessions).toHaveLength(1);
    });
  });

  describe('createSessionTimeoutService', () => {
    it('starts and stops correctly', () => {
      const storage = createMockStorage();
      const service = createSessionTimeoutService(storage);

      expect(service.isRunning()).toBe(false);

      service.start();
      expect(service.isRunning()).toBe(true);

      service.stop();
      expect(service.isRunning()).toBe(false);
    });

    it('does not start twice', () => {
      const storage = createMockStorage();
      const service = createSessionTimeoutService(storage);

      service.start();
      service.start(); // Should be ignored

      expect(service.isRunning()).toBe(true);

      service.stop();
      expect(service.isRunning()).toBe(false);
    });

    it('runs check immediately on start', async () => {
      const storage = createMockStorage();
      const session = createSession(31);
      storage.sessions.push(session);

      const service = createSessionTimeoutService(storage);
      service.start();

      // Give it time to run the initial check
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(storage.updatedSessions.length).toBeGreaterThanOrEqual(1);

      service.stop();
    });
  });
});
