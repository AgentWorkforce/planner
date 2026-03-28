/**
 * Agent Status Module Tests
 *
 * Tests for agent status event types and helper functions.
 * Mocks sendMessage to avoid actual relay calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AgentState, AgentRole } from './agent-status.js';

// Mock the client module to avoid actual relay communication
vi.mock('./client.js', () => ({
  sendMessage: vi.fn().mockReturnValue(true),
}));

// Import after mocking
import {
  emitAgentJoined,
  emitAgentStatusUpdate,
  emitAgentLeft,
  emitAgentsSnapshot,
  getActiveAgents,
} from './agent-status.js';
import { sendMessage } from './client.js';

describe('agent-status/types', () => {
  it('exports AgentState type', () => {
    // Compile-time check - if this compiles, the type exists
    const state: AgentState = 'idle';
    expect(state).toBe('idle');
  });

  it('exports AgentRole type', () => {
    // Compile-time check - if this compiles, the type exists
    const role: AgentRole = 'planner-lead';
    expect(role).toBe('planner-lead');
  });

  it('AgentState includes all expected states', () => {
    const states: AgentState[] = ['idle', 'working', 'needs_input', 'error'];
    expect(states).toHaveLength(4);
  });

  it('AgentRole includes all expected roles', () => {
    const roles: AgentRole[] = [
      'planner-lead',
      'architect',
      'ui-designer',
      'data-modeler',
      'coder',
      'tester',
      'security',
    ];
    expect(roles).toHaveLength(7);
  });
});

describe('agent-status/emitAgentJoined', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the registry by importing and re-exporting
    vi.resetModules();
  });

  it('adds agent to registry', async () => {
    const { emitAgentJoined, getActiveAgents } = await import('./agent-status.js');

    emitAgentJoined('agent-123', 'planner-lead', 'PlannerLead Instance');

    const agents = getActiveAgents();
    expect(agents.has('agent-123')).toBe(true);
    expect(agents.get('agent-123')).toEqual({
      role: 'planner-lead',
      displayName: 'PlannerLead Instance',
      state: 'idle',
    });
  });

  it('broadcasts agent_joined event', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined } = await import('./agent-status.js');

    emitAgentJoined('agent-456', 'coder', 'Backend Coder');

    expect(sendMessage).toHaveBeenCalledWith(
      '*',
      'agent_joined',
      'agent_status',
      expect.objectContaining({
        type: 'agent_joined',
        agentId: 'agent-456',
        role: 'coder',
        displayName: 'Backend Coder',
        state: 'idle',
        timestamp: expect.any(String),
      })
    );
  });

  it('sets initial state to idle', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined } = await import('./agent-status.js');

    emitAgentJoined('agent-789', 'architect', 'System Architect');

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as { state: string };
    expect(event.state).toBe('idle');
  });

  it('includes ISO 8601 timestamp', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined } = await import('./agent-status.js');

    emitAgentJoined('agent-abc', 'tester', 'QA Tester');

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as { timestamp: string };
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('agent-status/emitAgentStatusUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('updates agent state in registry', async () => {
    const { emitAgentJoined, emitAgentStatusUpdate, getActiveAgents } = await import('./agent-status.js');

    emitAgentJoined('agent-123', 'planner-lead', 'PlannerLead Instance');
    emitAgentStatusUpdate('agent-123', 'working');

    const agents = getActiveAgents();
    expect(agents.get('agent-123')?.state).toBe('working');
  });

  it('broadcasts agent_status_update event', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentStatusUpdate } = await import('./agent-status.js');

    emitAgentJoined('agent-456', 'coder', 'Backend Coder');
    vi.clearAllMocks(); // Clear the joined event call

    emitAgentStatusUpdate('agent-456', 'working');

    expect(sendMessage).toHaveBeenCalledWith(
      '*',
      'agent_status_update',
      'agent_status',
      expect.objectContaining({
        type: 'agent_status_update',
        agentId: 'agent-456',
        state: 'working',
        timestamp: expect.any(String),
      })
    );
  });

  it('handles optional activity field', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentStatusUpdate } = await import('./agent-status.js');

    emitAgentJoined('agent-789', 'architect', 'System Architect');
    vi.clearAllMocks();

    emitAgentStatusUpdate('agent-789', 'working', {
      activity: 'Analyzing system design',
    });

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as { activity?: string };
    expect(event.activity).toBe('Analyzing system design');
  });

  it('handles optional step field', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentStatusUpdate } = await import('./agent-status.js');

    emitAgentJoined('agent-abc', 'tester', 'QA Tester');
    vi.clearAllMocks();

    emitAgentStatusUpdate('agent-abc', 'working', {
      step: 'Running integration tests',
    });

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as { step?: string };
    expect(event.step).toBe('Running integration tests');
  });

  it('handles optional thought field', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentStatusUpdate } = await import('./agent-status.js');

    emitAgentJoined('agent-def', 'ui-designer', 'UI Designer');
    vi.clearAllMocks();

    emitAgentStatusUpdate('agent-def', 'working', {
      thought: 'Considering accessibility implications',
    });

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as { thought?: string };
    expect(event.thought).toBe('Considering accessibility implications');
  });

  it('handles all optional fields together', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentStatusUpdate } = await import('./agent-status.js');

    emitAgentJoined('agent-ghi', 'data-modeler', 'Data Modeler');
    vi.clearAllMocks();

    emitAgentStatusUpdate('agent-ghi', 'working', {
      activity: 'Designing schema',
      step: 'Create entity relationships',
      thought: 'Need to normalize user data',
    });

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as {
      activity?: string;
      step?: string;
      thought?: string;
    };
    expect(event.activity).toBe('Designing schema');
    expect(event.step).toBe('Create entity relationships');
    expect(event.thought).toBe('Need to normalize user data');
  });

  it('omits optional fields when not provided', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentStatusUpdate } = await import('./agent-status.js');

    emitAgentJoined('agent-jkl', 'security', 'Security Analyst');
    vi.clearAllMocks();

    emitAgentStatusUpdate('agent-jkl', 'working');

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as {
      activity?: string;
      step?: string;
      thought?: string;
    };
    expect(event).not.toHaveProperty('activity');
    expect(event).not.toHaveProperty('step');
    expect(event).not.toHaveProperty('thought');
  });

  it('handles agent not in registry gracefully', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentStatusUpdate } = await import('./agent-status.js');

    // Agent not joined yet - should still broadcast but not update registry
    emitAgentStatusUpdate('unknown-agent', 'working');

    expect(sendMessage).toHaveBeenCalledWith(
      '*',
      'agent_status_update',
      'agent_status',
      expect.objectContaining({
        agentId: 'unknown-agent',
        state: 'working',
      })
    );
  });

  it('updates through all state transitions', async () => {
    const { emitAgentJoined, emitAgentStatusUpdate, getActiveAgents } = await import('./agent-status.js');

    emitAgentJoined('agent-transitions', 'coder', 'State Tester');

    emitAgentStatusUpdate('agent-transitions', 'working');
    expect(getActiveAgents().get('agent-transitions')?.state).toBe('working');

    emitAgentStatusUpdate('agent-transitions', 'needs_input');
    expect(getActiveAgents().get('agent-transitions')?.state).toBe('needs_input');

    emitAgentStatusUpdate('agent-transitions', 'idle');
    expect(getActiveAgents().get('agent-transitions')?.state).toBe('idle');

    emitAgentStatusUpdate('agent-transitions', 'error');
    expect(getActiveAgents().get('agent-transitions')?.state).toBe('error');
  });
});

describe('agent-status/emitAgentLeft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('removes agent from registry', async () => {
    const { emitAgentJoined, emitAgentLeft, getActiveAgents } = await import('./agent-status.js');

    emitAgentJoined('agent-123', 'planner-lead', 'PlannerLead Instance');
    expect(getActiveAgents().has('agent-123')).toBe(true);

    emitAgentLeft('agent-123');
    expect(getActiveAgents().has('agent-123')).toBe(false);
  });

  it('broadcasts agent_left event', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentLeft } = await import('./agent-status.js');

    emitAgentJoined('agent-456', 'coder', 'Backend Coder');
    vi.clearAllMocks(); // Clear the joined event call

    emitAgentLeft('agent-456');

    expect(sendMessage).toHaveBeenCalledWith(
      '*',
      'agent_left',
      'agent_status',
      expect.objectContaining({
        type: 'agent_left',
        agentId: 'agent-456',
        timestamp: expect.any(String),
      })
    );
  });

  it('includes optional reason field', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentLeft } = await import('./agent-status.js');

    emitAgentJoined('agent-789', 'architect', 'System Architect');
    vi.clearAllMocks();

    emitAgentLeft('agent-789', 'task_complete');

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as { reason?: string };
    expect(event.reason).toBe('task_complete');
  });

  it('omits reason field when not provided', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentLeft } = await import('./agent-status.js');

    emitAgentJoined('agent-abc', 'tester', 'QA Tester');
    vi.clearAllMocks();

    emitAgentLeft('agent-abc');

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as { reason?: string };
    expect(event).not.toHaveProperty('reason');
  });

  it('handles various reason values', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentLeft } = await import('./agent-status.js');

    const reasons = ['shutdown', 'error', 'task_complete', 'timeout'];

    for (const reason of reasons) {
      vi.clearAllMocks();
      emitAgentJoined(`agent-${reason}`, 'coder', 'Test Agent');
      vi.clearAllMocks();

      emitAgentLeft(`agent-${reason}`, reason);

      const call = vi.mocked(sendMessage).mock.calls[0];
      const event = call[3] as { reason?: string };
      expect(event.reason).toBe(reason);
    }
  });

  it('handles agent not in registry gracefully', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentLeft } = await import('./agent-status.js');

    // Agent never joined - should still broadcast
    emitAgentLeft('unknown-agent', 'shutdown');

    expect(sendMessage).toHaveBeenCalledWith(
      '*',
      'agent_left',
      'agent_status',
      expect.objectContaining({
        agentId: 'unknown-agent',
        reason: 'shutdown',
      })
    );
  });
});

describe('agent-status/emitAgentsSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns empty array when no agents active', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentsSnapshot } = await import('./agent-status.js');

    emitAgentsSnapshot();

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as { agents: unknown[] };
    expect(event.agents).toEqual([]);
  });

  it('returns current registry state', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentsSnapshot } = await import('./agent-status.js');

    emitAgentJoined('agent-1', 'planner-lead', 'PlannerLead');
    emitAgentJoined('agent-2', 'coder', 'Backend Coder');
    emitAgentJoined('agent-3', 'tester', 'QA Tester');

    vi.clearAllMocks();
    emitAgentsSnapshot();

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as {
      agents: Array<{
        agentId: string;
        role: string;
        displayName: string;
        state: string;
      }>;
    };

    expect(event.agents).toHaveLength(3);
    expect(event.agents).toContainEqual({
      agentId: 'agent-1',
      role: 'planner-lead',
      displayName: 'PlannerLead',
      state: 'idle',
    });
    expect(event.agents).toContainEqual({
      agentId: 'agent-2',
      role: 'coder',
      displayName: 'Backend Coder',
      state: 'idle',
    });
    expect(event.agents).toContainEqual({
      agentId: 'agent-3',
      role: 'tester',
      displayName: 'QA Tester',
      state: 'idle',
    });
  });

  it('reflects current agent states', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentStatusUpdate, emitAgentsSnapshot } = await import('./agent-status.js');

    emitAgentJoined('agent-1', 'planner-lead', 'PlannerLead');
    emitAgentJoined('agent-2', 'coder', 'Backend Coder');

    emitAgentStatusUpdate('agent-1', 'working');
    emitAgentStatusUpdate('agent-2', 'needs_input');

    vi.clearAllMocks();
    emitAgentsSnapshot();

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as {
      agents: Array<{ agentId: string; state: string }>;
    };

    const agent1 = event.agents.find((a) => a.agentId === 'agent-1');
    const agent2 = event.agents.find((a) => a.agentId === 'agent-2');

    expect(agent1?.state).toBe('working');
    expect(agent2?.state).toBe('needs_input');
  });

  it('format matches expected shape', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentsSnapshot } = await import('./agent-status.js');

    emitAgentJoined('agent-test', 'architect', 'System Architect');

    vi.clearAllMocks();
    emitAgentsSnapshot();

    expect(sendMessage).toHaveBeenCalledWith(
      '*',
      'agents_snapshot',
      'agent_status',
      expect.objectContaining({
        type: 'agents_snapshot',
        agents: expect.arrayContaining([
          expect.objectContaining({
            agentId: expect.any(String),
            role: expect.any(String),
            displayName: expect.any(String),
            state: expect.any(String),
          }),
        ]),
        timestamp: expect.any(String),
      })
    );
  });

  it('broadcasts to all clients', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentsSnapshot } = await import('./agent-status.js');

    emitAgentsSnapshot();

    const call = vi.mocked(sendMessage).mock.calls[0];
    expect(call[0]).toBe('*'); // Broadcast recipient
  });

  it('excludes agents that have left', async () => {
    const { sendMessage } = await import('./client.js');
    const { emitAgentJoined, emitAgentLeft, emitAgentsSnapshot } = await import('./agent-status.js');

    emitAgentJoined('agent-1', 'planner-lead', 'PlannerLead');
    emitAgentJoined('agent-2', 'coder', 'Backend Coder');
    emitAgentLeft('agent-1');

    vi.clearAllMocks();
    emitAgentsSnapshot();

    const call = vi.mocked(sendMessage).mock.calls[0];
    const event = call[3] as {
      agents: Array<{ agentId: string }>;
    };

    expect(event.agents).toHaveLength(1);
    expect(event.agents[0].agentId).toBe('agent-2');
  });
});

describe('agent-status/getActiveAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns copy of registry, not reference', async () => {
    const { emitAgentJoined, getActiveAgents } = await import('./agent-status.js');

    emitAgentJoined('agent-1', 'planner-lead', 'PlannerLead');

    const agents1 = getActiveAgents();
    const agents2 = getActiveAgents();

    // Should be different Map instances
    expect(agents1).not.toBe(agents2);

    // But should have same content
    expect(agents1.get('agent-1')).toEqual(agents2.get('agent-1'));
  });

  it('returns empty Map when no agents active', async () => {
    const { getActiveAgents } = await import('./agent-status.js');

    const agents = getActiveAgents();

    expect(agents).toBeInstanceOf(Map);
    expect(agents.size).toBe(0);
  });

  it('returns all active agents', async () => {
    const { emitAgentJoined, getActiveAgents } = await import('./agent-status.js');

    emitAgentJoined('agent-1', 'planner-lead', 'PlannerLead');
    emitAgentJoined('agent-2', 'coder', 'Backend Coder');
    emitAgentJoined('agent-3', 'tester', 'QA Tester');

    const agents = getActiveAgents();

    expect(agents.size).toBe(3);
    expect(agents.has('agent-1')).toBe(true);
    expect(agents.has('agent-2')).toBe(true);
    expect(agents.has('agent-3')).toBe(true);
  });

  it('modifying returned Map does not affect registry', async () => {
    const { emitAgentJoined, getActiveAgents } = await import('./agent-status.js');

    emitAgentJoined('agent-1', 'planner-lead', 'PlannerLead');

    const agents = getActiveAgents();
    agents.delete('agent-1');

    const agentsAfter = getActiveAgents();
    expect(agentsAfter.has('agent-1')).toBe(true);
  });

  it('contains correct agent metadata', async () => {
    const { emitAgentJoined, getActiveAgents } = await import('./agent-status.js');

    emitAgentJoined('agent-test', 'ui-designer', 'UX Designer');

    const agents = getActiveAgents();
    const agent = agents.get('agent-test');

    expect(agent).toEqual({
      role: 'ui-designer',
      displayName: 'UX Designer',
      state: 'idle',
    });
  });

  it('reflects state updates', async () => {
    const { emitAgentJoined, emitAgentStatusUpdate, getActiveAgents } = await import('./agent-status.js');

    emitAgentJoined('agent-test', 'coder', 'Backend Coder');
    emitAgentStatusUpdate('agent-test', 'working');

    const agents = getActiveAgents();
    expect(agents.get('agent-test')?.state).toBe('working');
  });

  it('does not include agents that have left', async () => {
    const { emitAgentJoined, emitAgentLeft, getActiveAgents } = await import('./agent-status.js');

    emitAgentJoined('agent-1', 'planner-lead', 'PlannerLead');
    emitAgentJoined('agent-2', 'coder', 'Backend Coder');
    emitAgentLeft('agent-1');

    const agents = getActiveAgents();
    expect(agents.has('agent-1')).toBe(false);
    expect(agents.has('agent-2')).toBe(true);
  });
});
