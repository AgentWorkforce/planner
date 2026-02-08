/**
 * Relay Client Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  onMessage,
  sendChannelMessage,
  isConnected,
  getConnectionState,
  onStateChange,
  getRelayMode,
  setConnectionState,
  dispatchMessage,
  setSender,
} from './client.js';

describe('Ideation Relay Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to disconnected state and clear sender
    setConnectionState('disconnected');
    setSender(null);
  });

  describe('onMessage', () => {
    it('should register message handler', () => {
      const handler = vi.fn();
      const unsubscribe = onMessage(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call handler when message dispatched', async () => {
      const handler = vi.fn();
      onMessage(handler);

      dispatchMessage('Alice', 'Hello', 'thread-1', { foo: 'bar' });

      expect(handler).toHaveBeenCalledWith('Alice', 'Hello', 'thread-1', { foo: 'bar' });
    });

    it('should catch handler errors', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      onMessage(errorHandler);

      // Should not throw
      expect(() => {
        dispatchMessage('Alice', 'Hello');
      }).not.toThrow();
    });

    it('should unsubscribe properly', () => {
      const handler = vi.fn();
      const unsubscribe = onMessage(handler);

      unsubscribe();
      dispatchMessage('Alice', 'Hello');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('sendChannelMessage', () => {
    it('should return false when not connected', () => {
      const result = sendChannelMessage('#ideation', 'Hello world');

      expect(result).toBe(false);
    });

    it('should return true when connected with sender', () => {
      setConnectionState('connected');
      const mockSender = vi.fn().mockReturnValue(true);
      setSender(mockSender);

      const result = sendChannelMessage('#ideation', 'Hello world');

      expect(result).toBe(true);
      expect(mockSender).toHaveBeenCalledWith('#ideation', 'Hello world', undefined);
    });

    it('should return false when connected but no sender injected', () => {
      setConnectionState('connected');
      // No sender injected

      const result = sendChannelMessage('#ideation', 'Hello world');

      expect(result).toBe(false);
    });
  });

  describe('isConnected', () => {
    it('should return false when disconnected', () => {
      expect(isConnected()).toBe(false);
    });

    it('should return true when connected', () => {
      setConnectionState('connected');
      expect(isConnected()).toBe(true);
    });
  });

  describe('getConnectionState', () => {
    it('should return current state', () => {
      expect(getConnectionState()).toBe('disconnected');

      setConnectionState('connecting');
      expect(getConnectionState()).toBe('connecting');

      setConnectionState('connected');
      expect(getConnectionState()).toBe('connected');
    });
  });

  describe('onStateChange', () => {
    it('should register state change callback', () => {
      const callback = vi.fn();
      const unsubscribe = onStateChange(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback on state change', () => {
      const callback = vi.fn();
      onStateChange(callback);

      setConnectionState('connected');

      expect(callback).toHaveBeenCalledWith('connected');
    });

    it('should unsubscribe properly', () => {
      const callback = vi.fn();
      const unsubscribe = onStateChange(callback);

      unsubscribe();
      setConnectionState('connected');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getRelayMode', () => {
    it('should return mock when not connected', () => {
      expect(getRelayMode()).toBe('mock');
    });

    it('should return connected when relay is connected', () => {
      setConnectionState('connected');
      expect(getRelayMode()).toBe('connected');
    });
  });
});
