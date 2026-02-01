/**
 * Relay Module Tests
 *
 * Tests for config, client, and service modules.
 * Uses mocked @agent-relay/sdk to test without actual daemon.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the @agent-relay/sdk module
vi.mock('@agent-relay/sdk', () => {
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    destroy: vi.fn(),
    state: 'DISCONNECTED' as const,
    onStateChange: undefined as ((state: string) => void) | undefined,
    onError: undefined as ((error: Error) => void) | undefined,
  };

  return {
    RelayClient: vi.fn().mockImplementation((config) => {
      // Store config for testing
      (mockClient as any)._config = config;
      return mockClient;
    }),
  };
});

// Reset modules before importing to ensure clean state
beforeEach(async () => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
  // Clean up environment variables
  delete process.env.RELAY_SOCKET_PATH;
  delete process.env.RELAY_RECONNECT_INTERVAL;
  delete process.env.RELAY_MAX_RECONNECT_ATTEMPTS;
});

describe('relay/config', () => {
  describe('getRelayConfig', () => {
    it('returns default socket path when RELAY_SOCKET_PATH not set', async () => {
      const { getRelayConfig } = await import('./config.js');
      const config = getRelayConfig();

      // Default path is project-local .agent-relay/relay.sock
      expect(config.socketPath).toContain('.agent-relay/relay.sock');
    });

    it('uses custom socket path from RELAY_SOCKET_PATH env var', async () => {
      process.env.RELAY_SOCKET_PATH = '/custom/path/relay.sock';

      const { getRelayConfig } = await import('./config.js');
      const config = getRelayConfig();

      expect(config.socketPath).toBe('/custom/path/relay.sock');
    });

    it('returns default reconnect interval of 5000ms', async () => {
      const { getRelayConfig } = await import('./config.js');
      const config = getRelayConfig();

      expect(config.reconnectInterval).toBe(5000);
    });

    it('uses custom reconnect interval from env var', async () => {
      process.env.RELAY_RECONNECT_INTERVAL = '10000';

      const { getRelayConfig } = await import('./config.js');
      const config = getRelayConfig();

      expect(config.reconnectInterval).toBe(10000);
    });

    it('returns default max reconnect attempts of 0 (unlimited)', async () => {
      const { getRelayConfig } = await import('./config.js');
      const config = getRelayConfig();

      expect(config.maxReconnectAttempts).toBe(0);
    });

    it('uses custom max reconnect attempts from env var', async () => {
      process.env.RELAY_MAX_RECONNECT_ATTEMPTS = '5';

      const { getRelayConfig } = await import('./config.js');
      const config = getRelayConfig();

      expect(config.maxReconnectAttempts).toBe(5);
    });
  });
});

describe('relay/client', () => {
  describe('connect', () => {
    it('establishes connection to daemon socket', async () => {
      const { RelayClient } = await import('@agent-relay/sdk');
      const { connect, isConnected } = await import('./client.js');

      // Initially not connected
      expect(isConnected()).toBe(false);

      await connect();

      expect(RelayClient).toHaveBeenCalledWith(
        expect.objectContaining({
          agentName: 'planner-core',
          socketPath: expect.any(String),
          reconnect: true,
        })
      );
    });

    it('catches and logs connection errors without throwing', async () => {
      const { RelayClient } = await import('@agent-relay/sdk');
      const mockClient = {
        connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
        disconnect: vi.fn(),
        destroy: vi.fn(),
        onStateChange: undefined,
        onError: undefined,
      };
      (RelayClient as any).mockImplementation(() => mockClient);

      const { connect, isConnected } = await import('./client.js');

      // Should not throw
      await expect(connect()).resolves.not.toThrow();

      // Should remain disconnected
      expect(isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('cleanly closes connection', async () => {
      const { RelayClient } = await import('@agent-relay/sdk');
      const mockDisconnect = vi.fn();
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: mockDisconnect,
        destroy: vi.fn(),
        onStateChange: undefined,
        onError: undefined,
      };
      (RelayClient as any).mockImplementation(() => mockClient);

      const { connect, disconnect } = await import('./client.js');

      await connect();
      disconnect();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('returns false when not connected', async () => {
      const { isConnected } = await import('./client.js');

      expect(isConnected()).toBe(false);
    });
  });

  describe('getClient', () => {
    it('returns null when not connected', async () => {
      const { getClient } = await import('./client.js');

      expect(getClient()).toBeNull();
    });
  });

  describe('onStateChange', () => {
    it('notifies subscribers of state changes', async () => {
      const { onStateChange } = await import('./client.js');

      const callback = vi.fn();
      const unsubscribe = onStateChange(callback);

      expect(typeof unsubscribe).toBe('function');

      // Cleanup
      unsubscribe();
    });
  });
});

describe('relay/service', () => {
  describe('isRelayAvailable', () => {
    it('returns false before connect() called', async () => {
      const { isRelayAvailable } = await import('./service.js');

      expect(isRelayAvailable()).toBe(false);
    });
  });

  describe('getRelayMode', () => {
    it('returns disconnected when daemon not running', async () => {
      const { getRelayMode } = await import('./service.js');

      expect(getRelayMode()).toBe('disconnected');
    });

    it('returns mock when force mock mode enabled', async () => {
      const { getRelayMode, setForceMockMode } = await import('./service.js');

      setForceMockMode(true);

      expect(getRelayMode()).toBe('mock');

      // Cleanup
      setForceMockMode(false);
    });
  });

  describe('onModeChange', () => {
    it('notifies subscribers of mode changes', async () => {
      const { onModeChange, setForceMockMode } = await import('./service.js');

      const callback = vi.fn();
      const unsubscribe = onModeChange(callback);

      // Trigger mode change
      setForceMockMode(true);

      expect(callback).toHaveBeenCalledWith('mock');

      // Cleanup
      unsubscribe();
      setForceMockMode(false);
    });

    it('allows unsubscribing from mode changes', async () => {
      const { onModeChange, setForceMockMode } = await import('./service.js');

      const callback = vi.fn();
      const unsubscribe = onModeChange(callback);

      // Unsubscribe
      unsubscribe();

      // Trigger mode change
      setForceMockMode(true);
      setForceMockMode(false);

      // Should not have been called since we unsubscribed
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('setForceMockMode', () => {
    it('enables mock mode', async () => {
      const { setForceMockMode, getRelayMode, isRelayAvailable } = await import('./service.js');

      setForceMockMode(true);

      expect(getRelayMode()).toBe('mock');
      expect(isRelayAvailable()).toBe(false);

      // Cleanup
      setForceMockMode(false);
    });

    it('disables mock mode', async () => {
      const { setForceMockMode, getRelayMode } = await import('./service.js');

      setForceMockMode(true);
      setForceMockMode(false);

      expect(getRelayMode()).toBe('disconnected');
    });
  });
});
