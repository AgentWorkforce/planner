/**
 * PlannerLead Status Integration Tests
 *
 * Integration tests that verify PlannerLead emits proper status events
 * through the full flow: initialization, message handling, and shutdown.
 *
 * These tests verify the integration between planner-lead and agent-status modules,
 * ensuring PlannerLead has proper visibility in the UI status bar and orchestration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SqliteStorage } from '../storage/sqlite.js';

// Mock the relay client module
const mockSendMessage = vi.fn().mockReturnValue(true);
const mockSendChannelMessage = vi.fn().mockReturnValue(true);
const mockIsConnected = vi.fn().mockReturnValue(true);
const mockOnMessage = vi.fn().mockReturnValue(() => {});
const mockOnStateChange = vi.fn().mockReturnValue(() => {});

vi.mock('./client.js', () => ({
  onMessage: mockOnMessage,
  sendMessage: mockSendMessage,
  sendChannelMessage: mockSendChannelMessage,
  isConnected: mockIsConnected,
  onStateChange: mockOnStateChange,
}));

// Mock relay service - return 'connected' by default for these tests
const mockGetRelayMode = vi.fn().mockReturnValue('connected');
vi.mock('./service.js', () => ({
  getRelayMode: mockGetRelayMode,
}));

// Mock anthropic config (no API key = mock mode)
const mockGetAnthropicClient = vi.fn().mockReturnValue(null);
vi.mock('./anthropic-config.js', () => ({
  getAnthropicClient: mockGetAnthropicClient,
  hasApiKey: vi.fn().mockReturnValue(false),
  MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 1024,
}));

describe('planner-lead-status-integration', () => {
  let storage: SqliteStorage;
  let messageHandler: ((from: string, body: string, threadId?: string, data?: Record<string, unknown>) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new SqliteStorage(':memory:');

    // Capture the message handler when onMessage is called
    mockOnMessage.mockImplementation((handler: typeof messageHandler) => {
      messageHandler = handler;
      return () => {
        messageHandler = null;
      };
    });
  });

  afterEach(async () => {
    // Reset modules to clear state
    vi.resetModules();
    storage.close();
    messageHandler = null;
  });

  describe('initPlannerLead', () => {
    it('emits agent_joined when relay is connected', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);

      // Verify agent_joined was emitted
      expect(mockSendMessage).toHaveBeenCalledWith(
        '*',
        'agent_joined',
        'agent_status',
        expect.objectContaining({
          type: 'agent_joined',
          agentId: 'planner-core',
          role: 'planner-lead',
          displayName: 'Planning Assistant',
          state: 'idle',
          timestamp: expect.any(String),
        })
      );

      stopPlannerLead();
    });

    it('agent_joined has correct agentId format', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);

      const calls = vi.mocked(mockSendMessage).mock.calls;
      const joinedCall = calls.find((call) => call[1] === 'agent_joined');
      expect(joinedCall).toBeDefined();

      const event = joinedCall![3] as { agentId: string };
      expect(event.agentId).toBe('planner-core');

      stopPlannerLead();
    });

    it('agent_joined has role: planner-lead', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);

      const calls = vi.mocked(mockSendMessage).mock.calls;
      const joinedCall = calls.find((call) => call[1] === 'agent_joined');
      expect(joinedCall).toBeDefined();

      const event = joinedCall![3] as { role: string };
      expect(event.role).toBe('planner-lead');

      stopPlannerLead();
    });

    it('agent_joined has displayName: Planning Assistant', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);

      const calls = vi.mocked(mockSendMessage).mock.calls;
      const joinedCall = calls.find((call) => call[1] === 'agent_joined');
      expect(joinedCall).toBeDefined();

      const event = joinedCall![3] as { displayName: string };
      expect(event.displayName).toBe('Planning Assistant');

      stopPlannerLead();
    });

    it('does not emit agent_joined when relay is disconnected', async () => {
      mockGetRelayMode.mockReturnValue('disconnected');

      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      vi.clearAllMocks(); // Clear any setup calls
      initPlannerLead(storage);

      // Should not emit agent_joined when relay is disconnected
      const calls = vi.mocked(mockSendMessage).mock.calls;
      const joinedCall = calls.find((call) => call[1] === 'agent_joined');
      expect(joinedCall).toBeUndefined();

      stopPlannerLead();

      // Reset mock for other tests
      mockGetRelayMode.mockReturnValue('connected');
    });

    it('emits agent_joined on reconnection', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);

      // Capture the state change callback before clearing mocks
      expect(mockOnStateChange.mock.calls.length).toBeGreaterThan(0);
      const stateChangeCallback = mockOnStateChange.mock.calls[0]?.[0];
      expect(stateChangeCallback).toBeDefined();

      vi.clearAllMocks(); // Clear initial joined event

      // Simulate reconnection by calling the state change callback
      stateChangeCallback!('READY');

      // Should emit agent_joined on reconnection
      const calls = vi.mocked(mockSendMessage).mock.calls;
      const joinedCall = calls.find((call) => call[1] === 'agent_joined');
      expect(joinedCall).toBeDefined();

      stopPlannerLead();
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      const { initPlannerLead } = await import('./planner-lead.js');
      initPlannerLead(storage);
      vi.clearAllMocks(); // Clear the agent_joined event
    });

    afterEach(async () => {
      const { stopPlannerLead } = await import('./planner-lead.js');
      stopPlannerLead();
    });

    it('emits agent_status_update with state: working when processing starts', async () => {
      expect(messageHandler).not.toBeNull();

      // Trigger message handling (but don't await - we just want to check initial status)
      const messagePromise = messageHandler!('user-123', 'Help me plan', undefined, { channel: '#planner' });

      // Wait a tiny bit for the working state to be emitted
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check for working state
      const calls = vi.mocked(mockSendMessage).mock.calls;
      const workingCall = calls.find(
        (call) => call[1] === 'agent_status_update' && (call[3] as { state: string }).state === 'working'
      );
      expect(workingCall).toBeDefined();

      const event = workingCall![3] as { state: string; activity?: string; thought?: string };
      expect(event.state).toBe('working');
      expect(event.activity).toContain('Processing message');
      expect(event.thought).toContain('Help me plan');

      // Wait for message to complete
      await messagePromise;
    });

    it('emits agent_status_update with state: idle after processing completes', async () => {
      expect(messageHandler).not.toBeNull();

      await messageHandler!('user-123', 'Hello', undefined, { channel: '#planner' });

      // After processing completes, should emit idle state
      const calls = vi.mocked(mockSendMessage).mock.calls;
      const idleCall = calls.find(
        (call) => call[1] === 'agent_status_update' && (call[3] as { state: string }).state === 'idle'
      );
      expect(idleCall).toBeDefined();

      const event = idleCall![3] as { state: string; activity?: string };
      expect(event.state).toBe('idle');
      expect(event.activity).toBe('Waiting for messages');
    });

    it('working state includes activity field', async () => {
      expect(messageHandler).not.toBeNull();

      const messagePromise = messageHandler!('user-123', 'Add a step', undefined, { channel: '#planner' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = vi.mocked(mockSendMessage).mock.calls;
      const workingCall = calls.find(
        (call) => call[1] === 'agent_status_update' && (call[3] as { state: string }).state === 'working'
      );

      const event = workingCall![3] as { activity?: string };
      expect(event.activity).toBeDefined();
      expect(typeof event.activity).toBe('string');

      await messagePromise;
    });

    it('working state includes thought field with message preview', async () => {
      expect(messageHandler).not.toBeNull();

      const longMessage = 'This is a very long message that should be truncated in the thought field because it exceeds the maximum length for display';
      const messagePromise = messageHandler!('user-123', longMessage, undefined, { channel: '#planner' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = vi.mocked(mockSendMessage).mock.calls;
      const workingCall = calls.find(
        (call) => call[1] === 'agent_status_update' && (call[3] as { state: string }).state === 'working'
      );

      const event = workingCall![3] as { thought?: string };
      expect(event.thought).toBeDefined();
      expect(event.thought!.length).toBeLessThanOrEqual(103); // 100 chars + "..."

      await messagePromise;
    });

    it('working state includes step field when in plan channel', async () => {
      expect(messageHandler).not.toBeNull();

      const messagePromise = messageHandler!('user-123', 'What is the status?', undefined, { channel: '#plan-abc12345' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const calls = vi.mocked(mockSendMessage).mock.calls;
      const workingCall = calls.find(
        (call) => call[1] === 'agent_status_update' && (call[3] as { state: string }).state === 'working'
      );

      const event = workingCall![3] as { step?: string };
      expect(event.step).toBe('#plan-abc12345');

      await messagePromise;
    });

    it('emits working -> idle sequence in correct order', async () => {
      expect(messageHandler).not.toBeNull();

      await messageHandler!('user-123', 'Test message', undefined, { channel: '#planner' });

      // Find all status_update calls
      const calls = vi.mocked(mockSendMessage).mock.calls.filter(
        (call) => call[1] === 'agent_status_update'
      );

      expect(calls.length).toBeGreaterThanOrEqual(2);

      // First should be working
      const firstEvent = calls[0][3] as { state: string };
      expect(firstEvent.state).toBe('working');

      // Last should be idle
      const lastEvent = calls[calls.length - 1][3] as { state: string };
      expect(lastEvent.state).toBe('idle');
    });
  });

  describe('stopPlannerLead', () => {
    it('emits agent_left with reason: shutdown', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);
      vi.clearAllMocks(); // Clear the agent_joined event

      stopPlannerLead();

      // Verify agent_left was emitted
      expect(mockSendMessage).toHaveBeenCalledWith(
        '*',
        'agent_left',
        'agent_status',
        expect.objectContaining({
          type: 'agent_left',
          agentId: 'planner-core',
          reason: 'shutdown',
          timestamp: expect.any(String),
        })
      );
    });

    it('agent_left includes timestamp', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);
      vi.clearAllMocks();

      stopPlannerLead();

      const calls = vi.mocked(mockSendMessage).mock.calls;
      const leftCall = calls.find((call) => call[1] === 'agent_left');
      expect(leftCall).toBeDefined();

      const event = leftCall![3] as { timestamp: string };
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('emits agent_left before cleanup', async () => {
      const { initPlannerLead, stopPlannerLead, isPlannerLeadActive } = await import('./planner-lead.js');

      initPlannerLead(storage);
      vi.clearAllMocks();

      stopPlannerLead();

      // agent_left should be emitted
      const calls = vi.mocked(mockSendMessage).mock.calls;
      const leftCall = calls.find((call) => call[1] === 'agent_left');
      expect(leftCall).toBeDefined();

      // And service should be inactive after
      expect(isPlannerLeadActive()).toBe(false);
    });
  });

  describe('agent registry integration', () => {
    it('PlannerLead appears in active agents after init', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');
      const { getActiveAgents } = await import('./agent-status.js');

      initPlannerLead(storage);

      const agents = getActiveAgents();
      const plannerLeadEntry = Array.from(agents.entries()).find(
        ([id]) => id === 'planner-core'
      );

      expect(plannerLeadEntry).toBeDefined();
      expect(plannerLeadEntry![1]).toEqual({
        role: 'planner-lead',
        displayName: 'Planning Assistant',
        state: 'idle',
      });

      stopPlannerLead();
    });

    it('PlannerLead is removed from active agents after stop', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');
      const { getActiveAgents } = await import('./agent-status.js');

      initPlannerLead(storage);
      stopPlannerLead();

      const agents = getActiveAgents();
      const plannerLeadEntry = Array.from(agents.entries()).find(
        ([id]) => id === 'planner-core'
      );

      expect(plannerLeadEntry).toBeUndefined();
    });

    it('PlannerLead state updates are reflected in registry', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');
      const { getActiveAgents } = await import('./agent-status.js');

      initPlannerLead(storage);

      // Verify initial idle state
      const agentsInitial = getActiveAgents();
      const plannerLeadInitial = Array.from(agentsInitial.entries()).find(
        ([id]) => id === 'planner-core'
      );
      expect(plannerLeadInitial![1].state).toBe('idle');

      // Wait for message to complete - we'll check idle state after
      expect(messageHandler).not.toBeNull();
      await messageHandler!('user-123', 'Test', undefined, { channel: '#planner' });

      // After completion, should be back to idle
      const agentsAfter = getActiveAgents();
      const plannerLeadAfter = Array.from(agentsAfter.entries()).find(
        ([id]) => id === 'planner-core'
      );
      expect(plannerLeadAfter![1].state).toBe('idle');

      stopPlannerLead();
    });
  });

  describe('error handling', () => {
    it('returns error message when API call fails but continues operation', async () => {
      // Note: generateResponse catches errors internally and returns error message
      // instead of emitting error state. This test verifies that behavior.
      // The error state is only emitted when handleMessage itself fails,
      // which would require a different type of error (e.g., storage failure).

      vi.resetModules();

      // Mock Anthropic client to throw error
      mockGetAnthropicClient.mockReturnValue({
        messages: {
          create: vi.fn().mockRejectedValue(new Error('API error')),
        },
      });

      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);
      vi.clearAllMocks();

      expect(messageHandler).not.toBeNull();

      // Message handling should complete without throwing
      await messageHandler!('user-123', 'Test', undefined, { channel: '#planner' });

      // Should have sent an error message, but returned to idle (not error state)
      const calls = vi.mocked(mockSendMessage).mock.calls;
      const statusUpdates = calls.filter((call) => call[1] === 'agent_status_update');

      // Should have working -> idle sequence (error is handled gracefully)
      expect(statusUpdates.length).toBeGreaterThanOrEqual(2);
      const lastUpdate = statusUpdates[statusUpdates.length - 1][3] as { state: string };
      expect(lastUpdate.state).toBe('idle');

      stopPlannerLead();

      // Reset mock for other tests
      mockGetAnthropicClient.mockReturnValue(null);
    });
  });

  describe('broadcast mechanism', () => {
    it('all events are broadcast to * (all clients)', async () => {
      // Reset to ensure clean state with mock client
      vi.resetModules();
      mockGetAnthropicClient.mockReturnValue(null);

      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);
      vi.clearAllMocks();

      // Trigger a message to generate status updates
      expect(messageHandler).not.toBeNull();
      await messageHandler!('user-123', 'Test', undefined, { channel: '#planner' });

      stopPlannerLead();

      // All sendMessage calls for status events should use '*' as recipient
      const statusCalls = vi.mocked(mockSendMessage).mock.calls.filter(
        (call) => call[2] === 'agent_status'
      );

      expect(statusCalls.length).toBeGreaterThan(0);

      for (const call of statusCalls) {
        expect(call[0]).toBe('*'); // Broadcast to all
      }
    });
  });
});
