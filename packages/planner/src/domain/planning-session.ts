/**
 * PlanningSession domain entity.
 *
 * Represents the lifecycle of a planning agent session.
 * Sessions are created when agents spawn and terminate on:
 * - Plan approval (status: completed)
 * - Timeout (status: timeout)
 * - Manual termination (status: terminated)
 * - Error (status: error)
 */

/**
 * Session status values representing the session lifecycle.
 */
export type SessionStatus = 'active' | 'completed' | 'timeout' | 'terminated' | 'error';

/**
 * PlanningSession tracks an active planning agent.
 */
export interface PlanningSession {
  /** Unique session identifier */
  session_id: string;

  /** Plan this session is working on */
  plan_id: string;

  /** Agent identifier (from relay) */
  agent_id: string;

  /** Session token for MCP authentication */
  session_token: string;

  /** Current session status */
  status: SessionStatus;

  /** When the session started */
  started_at: string;

  /** When the session ended (null if still active) */
  ended_at: string | null;
}

/**
 * Create a new planning session.
 * Status defaults to 'active', ended_at is null.
 */
export function createPlanningSession(
  planId: string,
  agentId: string,
  sessionToken?: string
): PlanningSession {
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();

  return {
    session_id: sessionId,
    plan_id: planId,
    agent_id: agentId,
    session_token: sessionToken ?? crypto.randomUUID(),
    status: 'active',
    started_at: now,
    ended_at: null,
  };
}

/**
 * Check if a session is active.
 */
export function isSessionActive(session: PlanningSession): boolean {
  return session.status === 'active';
}

/**
 * Mark a session as completed (plan approved).
 */
export function completeSession(session: PlanningSession): PlanningSession {
  return {
    ...session,
    status: 'completed',
    ended_at: new Date().toISOString(),
  };
}

/**
 * Mark a session as timed out.
 */
export function timeoutSession(session: PlanningSession): PlanningSession {
  return {
    ...session,
    status: 'timeout',
    ended_at: new Date().toISOString(),
  };
}

/**
 * Mark a session as manually terminated.
 */
export function terminateSession(session: PlanningSession): PlanningSession {
  return {
    ...session,
    status: 'terminated',
    ended_at: new Date().toISOString(),
  };
}

/**
 * Mark a session as errored.
 */
export function errorSession(session: PlanningSession): PlanningSession {
  return {
    ...session,
    status: 'error',
    ended_at: new Date().toISOString(),
  };
}
