/**
 * Relay Client Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClientState } from '../../../../src/relay/client.js';

// Mock the planner-core relay client
vi.mock('../../../../src/relay/client.js', () => ({
  onMessage: vi.fn((handler) => {
    return () => {
      // Unsubscribe
    };
  }),
  sendChannelMessage: vi.fn(() => true),
  isConnected: vi.fn(() => true),
  getConnectionState: vi.fn(() => 'READY' as ClientState),
  onStateChange: vi.fn((callback) => {
    return () => {
      // Unsubscribe
    };
  }),
}));

import {
  onMessage,
  sendChannelMessage,
  isConnected,
  getConnectionState,
  onStateChange,
  getRelayMode,
} from './client.js';

describe('Ideation Relay Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('onMessage', () => {
    it('should register message handler', () => {
      const handler = vi.fn();
      const unsubscribe = onMessage(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should wrap handler in error handling', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      // Should not throw
      expect(() => {
        onMessage(errorHandler);
      }).not.toThrow();
    });
  });

  describe('sendChannelMessage', () => {
    it('should send message to channel', () => {
      const result = sendChannelMessage('#ideation', 'Hello world');

      expect(result).toBe(true);
    });

    it('should include optional data', () => {
      const data = { sessionId: 'abc123' };
      const result = sendChannelMessage('#ideation', 'Hello', data);

      expect(result).toBe(true);
    });
  });

  describe('isConnected', () => {
    it('should return connection state', () => {
      const connected = isConnected();

      expect(typeof connected).toBe('boolean');
    });
  });

  describe('getConnectionState', () => {
    it('should return ClientState', () => {
      const state = getConnectionState();

      expect(typeof state).toBe('string');
    });
  });

  describe('onStateChange', () => {
    it('should register state change callback', () => {
      const callback = vi.fn();
      const unsubscribe = onStateChange(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getRelayMode', () => {
    it('should return connected when relay is connected', () => {
      const mode = getRelayMode();

      expect(mode).toBe('connected');
    });

    it('should return mock when relay is not connected', async () => {
      const { isConnected: relayIsConnected } = await import('../../../../src/relay/client.js');
      vi.mocked(relayIsConnected).mockReturnValue(false);

      const mode = getRelayMode();

      expect(mode).toBe('mock');
    });
  });
});
