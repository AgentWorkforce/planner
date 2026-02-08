import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createPlanningSession,
  isSessionActive,
  completeSession,
  timeoutSession,
  terminateSession,
  errorSession,
  type PlanningSession,
} from './planning-session.js';

describe('planning-session', () => {
  const mockPlanId = 'plan-123';
  const mockAgentId = 'agent-456';
  const mockToken = 'token-789';

  describe('createPlanningSession', () => {
    it('creates a session with active status', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId, mockToken);

      expect(session.plan_id).toBe(mockPlanId);
      expect(session.agent_id).toBe(mockAgentId);
      expect(session.session_token).toBe(mockToken);
      expect(session.status).toBe('active');
      expect(session.ended_at).toBeNull();
    });

    it('generates session_id', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId, mockToken);

      expect(session.session_id).toBeDefined();
      expect(typeof session.session_id).toBe('string');
      expect(session.session_id.length).toBeGreaterThan(0);
    });

    it('generates session_token if not provided', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);

      expect(session.session_token).toBeDefined();
      expect(typeof session.session_token).toBe('string');
      expect(session.session_token.length).toBeGreaterThan(0);
    });

    it('sets started_at to current time', () => {
      const before = new Date().toISOString();
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const after = new Date().toISOString();

      expect(session.started_at).toBeDefined();
      expect(session.started_at >= before).toBe(true);
      expect(session.started_at <= after).toBe(true);
    });

    it('creates unique session_ids', () => {
      const session1 = createPlanningSession(mockPlanId, mockAgentId);
      const session2 = createPlanningSession(mockPlanId, mockAgentId);

      expect(session1.session_id).not.toBe(session2.session_id);
    });
  });

  describe('isSessionActive', () => {
    it('returns true for active sessions', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);

      expect(isSessionActive(session)).toBe(true);
    });

    it('returns false for completed sessions', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const completed = completeSession(session);

      expect(isSessionActive(completed)).toBe(false);
    });

    it('returns false for timed out sessions', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const timedOut = timeoutSession(session);

      expect(isSessionActive(timedOut)).toBe(false);
    });

    it('returns false for terminated sessions', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const terminated = terminateSession(session);

      expect(isSessionActive(terminated)).toBe(false);
    });

    it('returns false for errored sessions', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const errored = errorSession(session);

      expect(isSessionActive(errored)).toBe(false);
    });
  });

  describe('completeSession', () => {
    it('sets status to completed', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const completed = completeSession(session);

      expect(completed.status).toBe('completed');
    });

    it('sets ended_at', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const completed = completeSession(session);

      expect(completed.ended_at).toBeDefined();
      expect(completed.ended_at).not.toBeNull();
    });

    it('preserves other fields', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId, mockToken);
      const completed = completeSession(session);

      expect(completed.session_id).toBe(session.session_id);
      expect(completed.plan_id).toBe(session.plan_id);
      expect(completed.agent_id).toBe(session.agent_id);
      expect(completed.session_token).toBe(session.session_token);
      expect(completed.started_at).toBe(session.started_at);
    });

    it('returns a new object (immutable)', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const completed = completeSession(session);

      expect(completed).not.toBe(session);
      expect(session.status).toBe('active');
    });
  });

  describe('timeoutSession', () => {
    it('sets status to timeout', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const timedOut = timeoutSession(session);

      expect(timedOut.status).toBe('timeout');
    });

    it('sets ended_at', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const timedOut = timeoutSession(session);

      expect(timedOut.ended_at).toBeDefined();
      expect(timedOut.ended_at).not.toBeNull();
    });

    it('preserves other fields', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId, mockToken);
      const timedOut = timeoutSession(session);

      expect(timedOut.session_id).toBe(session.session_id);
      expect(timedOut.plan_id).toBe(session.plan_id);
      expect(timedOut.agent_id).toBe(session.agent_id);
      expect(timedOut.session_token).toBe(session.session_token);
      expect(timedOut.started_at).toBe(session.started_at);
    });
  });

  describe('terminateSession', () => {
    it('sets status to terminated', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const terminated = terminateSession(session);

      expect(terminated.status).toBe('terminated');
    });

    it('sets ended_at', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const terminated = terminateSession(session);

      expect(terminated.ended_at).toBeDefined();
      expect(terminated.ended_at).not.toBeNull();
    });

    it('preserves other fields', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId, mockToken);
      const terminated = terminateSession(session);

      expect(terminated.session_id).toBe(session.session_id);
      expect(terminated.plan_id).toBe(session.plan_id);
      expect(terminated.agent_id).toBe(session.agent_id);
      expect(terminated.session_token).toBe(session.session_token);
      expect(terminated.started_at).toBe(session.started_at);
    });
  });

  describe('errorSession', () => {
    it('sets status to error', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const errored = errorSession(session);

      expect(errored.status).toBe('error');
    });

    it('sets ended_at', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId);
      const errored = errorSession(session);

      expect(errored.ended_at).toBeDefined();
      expect(errored.ended_at).not.toBeNull();
    });

    it('preserves other fields', () => {
      const session = createPlanningSession(mockPlanId, mockAgentId, mockToken);
      const errored = errorSession(session);

      expect(errored.session_id).toBe(session.session_id);
      expect(errored.plan_id).toBe(session.plan_id);
      expect(errored.agent_id).toBe(session.agent_id);
      expect(errored.session_token).toBe(session.session_token);
      expect(errored.started_at).toBe(session.started_at);
    });
  });
});
