/**
 * PlannerLead Service Integration Tests
 *
 * Tests for message handling, response generation, and lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SqliteStorage } from '../../../planner/src/storage/sqlite.js';

// Mock the relay client module
const mockSendMessage = vi.fn().mockReturnValue(true);
const mockSendChannelMessage = vi.fn().mockReturnValue(true);
const mockIsConnected = vi.fn().mockReturnValue(false);
const mockOnMessage = vi.fn().mockReturnValue(() => {});
const mockOnStateChange = vi.fn().mockReturnValue(() => {});

vi.mock('./client.js', () => ({
  onMessage: mockOnMessage,
  sendMessage: mockSendMessage,
  sendChannelMessage: mockSendChannelMessage,
  isConnected: mockIsConnected,
  onStateChange: mockOnStateChange,
}));

// Mock relay service
vi.mock('./service.js', () => ({
  getRelayMode: vi.fn().mockReturnValue('disconnected'),
}));

// Mock anthropic config (no API key = mock mode)
vi.mock('./anthropic-config.js', () => ({
  getAnthropicClient: vi.fn().mockReturnValue(null),
  hasApiKey: vi.fn().mockReturnValue(false),
  MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 1024,
}));

describe('planner-lead', () => {
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
    it('registers message handler', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);

      expect(mockOnMessage).toHaveBeenCalledTimes(1);
      expect(typeof mockOnMessage.mock.calls[0][0]).toBe('function');

      stopPlannerLead();
    });

    it('subscribes to state changes', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);

      expect(mockOnStateChange).toHaveBeenCalledTimes(1);

      stopPlannerLead();
    });

    it('sets isPlannerLeadActive to true', async () => {
      const { initPlannerLead, isPlannerLeadActive, stopPlannerLead } = await import('./planner-lead.js');

      expect(isPlannerLeadActive()).toBe(false);

      initPlannerLead(storage);

      expect(isPlannerLeadActive()).toBe(true);

      stopPlannerLead();
    });

    it('does not initialize twice', async () => {
      const { initPlannerLead, stopPlannerLead } = await import('./planner-lead.js');

      initPlannerLead(storage);
      initPlannerLead(storage);

      expect(mockOnMessage).toHaveBeenCalledTimes(1);

      stopPlannerLead();
    });
  });

  describe('stopPlannerLead', () => {
    it('unregisters message handler', async () => {
      const { initPlannerLead, stopPlannerLead, isPlannerLeadActive } = await import('./planner-lead.js');

      initPlannerLead(storage);
      stopPlannerLead();

      expect(isPlannerLeadActive()).toBe(false);
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      const { initPlannerLead } = await import('./planner-lead.js');
      initPlannerLead(storage);
    });

    afterEach(async () => {
      const { stopPlannerLead } = await import('./planner-lead.js');
      stopPlannerLead();
    });

    it('handles messages in #planner channel', async () => {
      expect(messageHandler).not.toBeNull();

      await messageHandler!('user-123', 'Hello, help me plan', undefined, { channel: '#planner' });

      // Wait for async handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSendChannelMessage).toHaveBeenCalledTimes(1);
      expect(mockSendChannelMessage.mock.calls[0][0]).toBe('#planner');
      expect(mockSendChannelMessage.mock.calls[0][1]).toContain('Mock Mode');
    });

    it('handles messages in plan-specific channels', async () => {
      expect(messageHandler).not.toBeNull();

      await messageHandler!('user-123', 'What is the status?', undefined, { channel: '#plan-abc12345' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSendChannelMessage).toHaveBeenCalledTimes(1);
      expect(mockSendChannelMessage.mock.calls[0][0]).toBe('#plan-abc12345');
    });

    it('ignores messages from planner-core', async () => {
      await messageHandler!('planner-core', 'Test message', undefined, { channel: '#planner' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSendChannelMessage).not.toHaveBeenCalled();
    });

    it('ignores messages from PlannerLead', async () => {
      await messageHandler!('PlannerLead', 'Test message', undefined, { channel: '#planner' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSendChannelMessage).not.toHaveBeenCalled();
    });

    it('ignores messages in irrelevant channels', async () => {
      await messageHandler!('user-123', 'Test message', undefined, { channel: '#random' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSendChannelMessage).not.toHaveBeenCalled();
    });

    it('responds with mock mode message when Anthropic API unavailable', async () => {
      await messageHandler!('user-123', 'Help me with planning', undefined, { channel: '#planner' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSendChannelMessage).toHaveBeenCalledTimes(1);
      const responseBody = mockSendChannelMessage.mock.calls[0][1];
      expect(responseBody).toContain('Mock Mode');
      expect(responseBody).toContain('ANTHROPIC_API_KEY');
    });
  });

  describe('mention filtering', () => {
    beforeEach(async () => {
      const { initPlannerLead, setRequireMention } = await import('./planner-lead.js');
      initPlannerLead(storage);
      setRequireMention(true);
    });

    afterEach(async () => {
      const { stopPlannerLead, setRequireMention } = await import('./planner-lead.js');
      setRequireMention(false);
      stopPlannerLead();
    });

    it('responds to messages with @PlannerLead mention', async () => {
      await messageHandler!('user-123', '@PlannerLead help me', undefined, { channel: '#planner' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSendChannelMessage).toHaveBeenCalledTimes(1);
    });

    it('ignores messages without @PlannerLead mention when filtering enabled', async () => {
      await messageHandler!('user-123', 'Help me plan', undefined, { channel: '#planner' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockSendChannelMessage).not.toHaveBeenCalled();
    });
  });

  describe('mock response generation', () => {
    beforeEach(async () => {
      const { initPlannerLead } = await import('./planner-lead.js');
      initPlannerLead(storage);
    });

    afterEach(async () => {
      const { stopPlannerLead } = await import('./planner-lead.js');
      stopPlannerLead();
    });

    it('generates appropriate response for status query', async () => {
      await messageHandler!('user-123', 'What is the status?', undefined, { channel: '#planner' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = mockSendChannelMessage.mock.calls[0][1];
      expect(response).toContain('status');
    });

    it('generates appropriate response for add step request', async () => {
      await messageHandler!('user-123', 'Please add a step for testing', undefined, { channel: '#planner' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = mockSendChannelMessage.mock.calls[0][1];
      expect(response).toContain('add');
    });

    it('generates help response for questions', async () => {
      await messageHandler!('user-123', 'How can you help me?', undefined, { channel: '#planner' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = mockSendChannelMessage.mock.calls[0][1];
      expect(response).toContain('planning assistant');
    });
  });

  describe('legacy API compatibility', () => {
    it('spawnPlannerLead returns false with warning', async () => {
      const { spawnPlannerLead } = await import('./planner-lead.js');

      const result = await spawnPlannerLead();

      expect(result).toBe(false);
    });

    it('terminatePlannerLead resolves without error', async () => {
      const { terminatePlannerLead } = await import('./planner-lead.js');

      await expect(terminatePlannerLead()).resolves.toBeUndefined();
    });

    it('joinPlannerLeadToChannel does nothing', async () => {
      const { joinPlannerLeadToChannel } = await import('./planner-lead.js');

      // Should not throw
      joinPlannerLeadToChannel('#test-channel');
    });

    it('getPlannerLeadAgentId returns name when active', async () => {
      const { initPlannerLead, stopPlannerLead, getPlannerLeadAgentId } = await import('./planner-lead.js');

      expect(getPlannerLeadAgentId()).toBeNull();

      initPlannerLead(storage);

      expect(getPlannerLeadAgentId()).toBe('planner-core');

      stopPlannerLead();
    });
  });

  describe('getPlannerLeadConfig', () => {
    it('returns configuration object', async () => {
      const { getPlannerLeadConfig } = await import('./planner-lead.js');

      const config = getPlannerLeadConfig();

      expect(config.name).toBe('PlannerLead');
      expect(config.displayName).toBe('Planning Assistant');
      expect(typeof config.requireMention).toBe('boolean');
    });
  });
});
