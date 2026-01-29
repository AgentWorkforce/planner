/**
 * Spawner Module Tests
 *
 * Tests for planning agent spawning and termination.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the @agent-relay/sdk module
vi.mock('@agent-relay/sdk', () => {
  return {
    RelayClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      destroy: vi.fn(),
      state: 'READY',
      onStateChange: undefined,
      onError: undefined,
      spawn: vi.fn().mockResolvedValue({
        name: 'Planner-test1234',
        success: true,
        pid: 12345,
      }),
      release: vi.fn().mockResolvedValue({
        released: true,
      }),
    })),
  };
});

// Reset modules before each test
beforeEach(async () => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('spawner/system-prompt', () => {
  it('exports valid string with planning agent role definition', async () => {
    const { getPlanningAgentPrompt } = await import('./spawner.js');
    const prompt = getPlanningAgentPrompt();

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('Planning Agent');
  });

  it('includes MCP tool usage instructions', async () => {
    const { getPlanningAgentPrompt } = await import('./spawner.js');
    const prompt = getPlanningAgentPrompt();

    expect(prompt).toContain('MCP');
    expect(prompt).toContain('read_plan');
    expect(prompt).toContain('add_step');
  });

  it('includes human collaboration instructions', async () => {
    const { getPlanningAgentPrompt } = await import('./spawner.js');
    const prompt = getPlanningAgentPrompt();

    expect(prompt).toContain('human');
    expect(prompt).toContain('collaborat');
  });

  it('includes improvement analysis instructions', async () => {
    const { getPlanningAgentPrompt } = await import('./spawner.js');
    const prompt = getPlanningAgentPrompt();

    expect(prompt).toContain('improvement');
    expect(prompt).toContain('suggest');
  });
});

describe('spawner/spawnPlanningAgent', () => {
  it('throws when relay not connected', async () => {
    // Mock client as not connected
    vi.doMock('./client.js', () => ({
      getClient: () => null,
      isConnected: () => false,
    }));

    const { spawnPlanningAgent } = await import('./spawner.js');

    await expect(
      spawnPlanningAgent({
        planId: 'test-plan-id',
        goal: 'Test goal',
      })
    ).rejects.toThrow('Relay client not connected');
  });
});

describe('spawner/terminateAgent', () => {
  it('handles not connected gracefully', async () => {
    vi.doMock('./client.js', () => ({
      getClient: () => null,
      isConnected: () => false,
    }));

    const { terminateAgent } = await import('./spawner.js');

    // Should not throw
    await expect(terminateAgent('test-agent')).resolves.not.toThrow();
  });
});

describe('spawner/createSpawner', () => {
  it('returns spawner interface', async () => {
    const { createSpawner } = await import('./spawner.js');
    const spawner = createSpawner();

    expect(typeof spawner.spawn).toBe('function');
    expect(typeof spawner.spawnRevision).toBe('function');
    expect(typeof spawner.terminate).toBe('function');
  });
});

describe('spawner/revision-agent-prompt', () => {
  it('exports valid string with revision agent role definition', async () => {
    const { getRevisionAgentPrompt } = await import('./spawner.js');
    const prompt = getRevisionAgentPrompt();

    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain('Revision Agent');
  });

  it('includes change request analysis instructions', async () => {
    const { getRevisionAgentPrompt } = await import('./spawner.js');
    const prompt = getRevisionAgentPrompt();

    expect(prompt).toContain('Change Request');
    expect(prompt).toContain('change_request_id');
    expect(prompt).toContain('suggested_changes');
  });

  it('emphasizes minimal changes', async () => {
    const { getRevisionAgentPrompt } = await import('./spawner.js');
    const prompt = getRevisionAgentPrompt();

    expect(prompt).toContain('minimal');
    expect(prompt).toContain('Minimal Changes');
  });
});

describe('spawner/spawnRevisionAgent', () => {
  it('throws when relay not connected', async () => {
    vi.doMock('./client.js', () => ({
      getClient: () => null,
      isConnected: () => false,
    }));

    const { spawnRevisionAgent } = await import('./spawner.js');

    const changeRequest = {
      change_request_id: 'cr-123',
      run_id: 'run-456',
      plan_id: 'plan-789',
      reason: 'Missing step for database setup',
      suggested_changes: {
        add_steps: [{ step_id: 's1', title: 'Setup database', dependencies: [] }],
      },
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await expect(
      spawnRevisionAgent({
        planId: 'plan-789',
        changeRequest,
        currentVersion: 1,
      })
    ).rejects.toThrow('Relay client not connected');
  });
});

describe('mock-spawner', () => {
  it('matches spawner interface', async () => {
    const { createMockSpawner } = await import('./mock-spawner.js');
    const spawner = createMockSpawner();

    expect(typeof spawner.spawn).toBe('function');
    expect(typeof spawner.terminate).toBe('function');
  });

  it('returns mock agentId and sessionToken', async () => {
    const { createMockSpawner } = await import('./mock-spawner.js');
    const spawner = createMockSpawner({ spawnDelayMs: 0 });

    const result = await spawner.spawn({
      planId: 'test-plan-id',
      goal: 'Test goal',
    });

    expect(result.agentId).toMatch(/^mock-planner-/);
    expect(result.sessionToken).toMatch(/^mock-session-/);
    expect(result.isMock).toBe(true);
  });

  it('terminates mock agent', async () => {
    const { createMockSpawner, getActiveMockAgents, clearMockAgents } = await import('./mock-spawner.js');

    // Clear any existing agents
    clearMockAgents();

    const spawner = createMockSpawner({ spawnDelayMs: 0, terminateDelayMs: 0 });

    const result = await spawner.spawn({
      planId: 'test-plan-id',
      goal: 'Test goal',
    });

    expect(getActiveMockAgents()).toContain(result.agentId);

    await spawner.terminate(result.agentId);

    expect(getActiveMockAgents()).not.toContain(result.agentId);
  });

  it('handles terminating non-existent agent gracefully', async () => {
    const { createMockSpawner } = await import('./mock-spawner.js');
    const spawner = createMockSpawner({ terminateDelayMs: 0 });

    // Should not throw
    await expect(spawner.terminate('non-existent-agent')).resolves.not.toThrow();
  });

  it('isMockAgent identifies mock agents', async () => {
    const { isMockAgent } = await import('./mock-spawner.js');

    expect(isMockAgent('mock-planner-abc')).toBe(true);
    expect(isMockAgent('Planner-abc')).toBe(false);
  });
});
