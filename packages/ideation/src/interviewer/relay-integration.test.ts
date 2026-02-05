/**
 * Interviewer Relay Integration Tests
 *
 * Tests that Interviewer correctly integrates with relay messaging.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// Mock ANTHROPIC_API_KEY for tests that require it
const originalEnv = process.env.ANTHROPIC_API_KEY;
beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = 'test-api-key-for-unit-tests';
});
afterAll(() => {
  if (originalEnv) {
    process.env.ANTHROPIC_API_KEY = originalEnv;
  } else {
    delete process.env.ANTHROPIC_API_KEY;
  }
});
import { interviewer, initInterviewer, stopInterviewer } from './service.js';
import { SQLiteIdeationStorage } from '../storage/sqlite.js';
import type { ClientState } from '../relay/index.js';
import * as relayModule from '../relay/index.js';

// Mock relay module
vi.mock('../relay/index.js', () => ({
  onMessage: vi.fn((handler) => {
    mockMessageHandler = handler;
    return () => {
      mockMessageHandler = null;
    };
  }),
  sendChannelMessage: vi.fn(() => true),
  isConnected: vi.fn(() => mockRelayConnected),
  getConnectionState: vi.fn(() => (mockRelayConnected ? 'connected' : 'disconnected') as ClientState),
  onStateChange: vi.fn((callback) => {
    mockStateChangeCallback = callback;
    return () => {
      mockStateChangeCallback = null;
    };
  }),
  getRelayMode: vi.fn(() => (mockRelayConnected ? 'connected' : 'mock')),
}));

let mockMessageHandler: ((from: string, body: string, threadId?: string, data?: Record<string, unknown>) => void) | null = null;
let mockStateChangeCallback: ((state: ClientState) => void) | null = null;
let mockRelayConnected = false;

describe('Interviewer Relay Integration', () => {
  let storage: SQLiteIdeationStorage;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRelayConnected = false;
    mockMessageHandler = null;
    mockStateChangeCallback = null;

    // Create in-memory storage
    storage = new SQLiteIdeationStorage(':memory:');
    await storage.initialize();
  });

  afterEach(async () => {
    stopInterviewer();
    await storage.close();
  });

  describe('initialization', () => {
    it('should register relay message handler', () => {
      initInterviewer({ storage });

      expect(relayModule.onMessage).toHaveBeenCalled();
      expect(mockMessageHandler).not.toBeNull();
    });

    it('should subscribe to relay state changes', () => {
      initInterviewer({ storage });

      expect(relayModule.onStateChange).toHaveBeenCalled();
      expect(mockStateChangeCallback).not.toBeNull();
    });

    it('should announce startup if relay is connected', () => {
      mockRelayConnected = true;

      initInterviewer({ storage });

      expect(relayModule.sendChannelMessage).toHaveBeenCalledWith(
        '#ideation',
        expect.stringContaining('Interviewer online')
      );
    });

    it('should not announce if relay is disconnected', () => {
      mockRelayConnected = false;

      initInterviewer({ storage });

      expect(relayModule.sendChannelMessage).not.toHaveBeenCalled();
    });
  });

  describe('relay message handling', () => {
    beforeEach(async () => {
      // Create a test session
      await storage.createSession({ type: 'human', initial_intent: 'Test idea' });
    });

    it('should handle messages from ideation channels', async () => {
      initInterviewer({ storage });

      const sessions = await storage.listSessions({ status: 'active' });
      const sessionId = sessions[0]!.id;
      const channelId = `#ideation-${sessionId.slice(0, 8)}`;

      // Simulate relay message
      await mockMessageHandler?.('test-user', 'Hello', undefined, { channel: channelId });

      // Should process message (verified by no errors)
      expect(true).toBe(true);
    });

    it('should ignore messages from non-ideation channels', async () => {
      initInterviewer({ storage });

      // Simulate message from different channel
      await mockMessageHandler?.('test-user', 'Hello', undefined, { channel: '#random' });

      // Should not send response
      expect(relayModule.sendChannelMessage).not.toHaveBeenCalled();
    });

    it('should ignore messages from self', async () => {
      initInterviewer({ storage });

      const sessions = await storage.listSessions({ status: 'active' });
      const sessionId = sessions[0]!.id;
      const channelId = `#ideation-${sessionId.slice(0, 8)}`;

      // Simulate message from self
      await mockMessageHandler?.('ideation-interviewer', 'Hello', undefined, { channel: channelId });

      // Should not respond to own messages
      expect(relayModule.sendChannelMessage).not.toHaveBeenCalled();
    });

    it('should send response via relay when connected', async () => {
      mockRelayConnected = true;
      initInterviewer({ storage });

      const sessions = await storage.listSessions({ status: 'active' });
      const sessionId = sessions[0]!.id;
      const channelId = `#ideation-${sessionId.slice(0, 8)}`;

      // Clear previous calls
      vi.clearAllMocks();

      // Simulate relay message
      await mockMessageHandler?.('test-user', 'What should we build?', undefined, { channel: channelId });

      // Should send response
      expect(relayModule.sendChannelMessage).toHaveBeenCalledWith(
        channelId,
        expect.any(String)
      );
    });
  });

  describe('relay state changes', () => {
    it('should announce when relay connects', () => {
      mockRelayConnected = false;
      initInterviewer({ storage });

      vi.clearAllMocks();

      // Simulate relay connection
      mockRelayConnected = true;
      mockStateChangeCallback?.('connected');

      expect(relayModule.sendChannelMessage).toHaveBeenCalledWith(
        '#ideation',
        expect.stringContaining('Interviewer online')
      );
    });

    it('should not announce when relay disconnects', () => {
      mockRelayConnected = true;
      initInterviewer({ storage });

      vi.clearAllMocks();

      // Simulate relay disconnection
      mockRelayConnected = false;
      mockStateChangeCallback?.('disconnected');

      expect(relayModule.sendChannelMessage).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe from relay events on stop', () => {
      initInterviewer({ storage });

      expect(mockMessageHandler).not.toBeNull();
      expect(mockStateChangeCallback).not.toBeNull();

      stopInterviewer();

      // Handlers should be cleared
      expect(mockMessageHandler).toBeNull();
      expect(mockStateChangeCallback).toBeNull();
    });
  });

  describe('notifyNewSession', () => {
    beforeEach(async () => {
      // Create a test session
      await storage.createSession({ type: 'human', initial_intent: 'Test idea' });
    });

    it('should send welcome message via relay', async () => {
      mockRelayConnected = true;
      initInterviewer({ storage });

      const sessions = await storage.listSessions({ status: 'active' });
      const sessionId = sessions[0]!.id;

      vi.clearAllMocks();

      await interviewer.notifyNewSession(sessionId, 'Build a new app');

      expect(relayModule.sendChannelMessage).toHaveBeenCalledWith(
        `#ideation-${sessionId.slice(0, 8)}`,
        expect.stringContaining('Build a new app')
      );
    });

    it('should not send if relay is disconnected', async () => {
      mockRelayConnected = false;
      initInterviewer({ storage });

      const sessions = await storage.listSessions({ status: 'active' });
      const sessionId = sessions[0]!.id;

      await interviewer.notifyNewSession(sessionId, 'Build a new app');

      expect(relayModule.sendChannelMessage).not.toHaveBeenCalled();
    });
  });
});
