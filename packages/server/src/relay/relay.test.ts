/**
 * Relay Module Tests
 *
 * Tests for config, client, and service modules.
 * Uses mocked @agent-relay/sdk to test without actual daemon.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the @agent-relay/sdk module with AgentRelay (3.x API)
vi.mock('@agent-relay/sdk', () => {
  const mockShutdown = vi.fn().mockResolvedValue(undefined);
  const mockSpawn = vi.fn().mockResolvedValue({
    name: 'TestAgent',
    release: vi.fn().mockResolvedValue(undefined),
    waitForExit: vi.fn().mockResolvedValue('exited'),
    waitForReady: vi.fn().mockResolvedValue(undefined),
    exitCode: undefined,
    exitSignal: undefined,
    channels: [],
    status: 'ready',
    runtime: 'pty',
    sendMessage: vi.fn(),
    onOutput: vi.fn(),
  });

  const mockHuman = vi.fn().mockReturnValue({
    name: 'PlannerCore',
    sendMessage: vi.fn().mockResolvedValue({ eventId: 'e1', from: 'PlannerCore', to: 'Test', text: 'hello' }),
  });

  return {
    AgentRelay: vi.fn().mockImplementation(() => ({
      shutdown: mockShutdown,
      spawn: mockSpawn,
      human: mockHuman,
      listAgents: vi.fn().mockResolvedValue([]),
      onMessageReceived: null,
      onAgentExited: null,
      onAgentSpawned: null,
      onAgentReady: null,
    })),
  };
});

// Reset modules before importing to ensure clean state
beforeEach(async () => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
  // Clean up environment variables
  delete process.env.RELAY_CWD;
  delete process.env.MCP_SERVER_URL;
  delete process.env.MCP_SERVER_HOST;
  delete process.env.PORT;
});

describe('relay/config', () => {
  describe('getRelayConfig', () => {
    it('returns cwd defaulting to project root', async () => {
      const { getRelayConfig } = await import('./config.js');
      const config = getRelayConfig();

      // Default cwd is resolved to the project root (4 levels up from this file)
      expect(typeof config.cwd).toBe('string');
      expect(config.cwd.length).toBeGreaterThan(0);
    });

    it('returns mcpServerUrl defaulting to http://localhost:3001/api/mcp', async () => {
      const { getRelayConfig } = await import('./config.js');
      const config = getRelayConfig();

      expect(config.mcpServerUrl).toBe('http://localhost:3001/api/mcp');
    });

    it('uses RELAY_CWD env var to override cwd', async () => {
      process.env.RELAY_CWD = '/custom/project/root';

      const { getRelayConfig } = await import('./config.js');
      const config = getRelayConfig();

      expect(config.cwd).toBe('/custom/project/root');
    });

    it('uses MCP_SERVER_URL env var to override mcpServerUrl', async () => {
      process.env.MCP_SERVER_URL = 'http://custom-host:9999/mcp';

      const { getRelayConfig } = await import('./config.js');
      const config = getRelayConfig();

      expect(config.mcpServerUrl).toBe('http://custom-host:9999/mcp');
    });
  });
});

describe('relay/client', () => {
  describe('connect', () => {
    it('creates AgentRelay with correct cwd from config', async () => {
      const { AgentRelay } = await import('@agent-relay/sdk');
      const { connect } = await import('./client.js');

      await connect();

      expect(AgentRelay).toHaveBeenCalledWith(
        expect.objectContaining({
          cwd: expect.any(String),
        })
      );
    });

    it('wires onMessageReceived, onAgentExited, and onAgentSpawned hooks', async () => {
      const { AgentRelay } = await import('@agent-relay/sdk');
      let capturedInstance: Record<string, unknown> | null = null;

      (AgentRelay as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        const instance: Record<string, unknown> = {
          shutdown: vi.fn().mockResolvedValue(undefined),
          spawn: vi.fn(),
          human: vi.fn().mockReturnValue({ name: 'PlannerCore', sendMessage: vi.fn() }),
          listAgents: vi.fn().mockResolvedValue([]),
          onMessageReceived: null,
          onAgentExited: null,
          onAgentSpawned: null,
          onAgentReady: null,
        };
        capturedInstance = instance;
        return instance;
      });

      const { connect } = await import('./client.js');
      await connect();

      expect(capturedInstance).not.toBeNull();
      expect(typeof capturedInstance!.onMessageReceived).toBe('function');
      expect(typeof capturedInstance!.onAgentExited).toBe('function');
      expect(typeof capturedInstance!.onAgentSpawned).toBe('function');
    });

    it('creates humanHandle via relay.human({ name: "PlannerCore" })', async () => {
      const { AgentRelay } = await import('@agent-relay/sdk');
      const mockHumanFn = vi.fn().mockReturnValue({ name: 'PlannerCore', sendMessage: vi.fn() });

      (AgentRelay as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        shutdown: vi.fn().mockResolvedValue(undefined),
        spawn: vi.fn(),
        human: mockHumanFn,
        listAgents: vi.fn().mockResolvedValue([]),
        onMessageReceived: null,
        onAgentExited: null,
        onAgentSpawned: null,
        onAgentReady: null,
      }));

      const { connect } = await import('./client.js');
      await connect();

      expect(mockHumanFn).toHaveBeenCalledWith({ name: 'PlannerCore' });
    });
  });

  describe('isConnected', () => {
    it('returns false when not connected', async () => {
      const { isConnected } = await import('./client.js');

      expect(isConnected()).toBe(false);
    });

    it('returns true after connect()', async () => {
      const { connect, isConnected } = await import('./client.js');

      await connect();

      expect(isConnected()).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('calls relay.shutdown()', async () => {
      const { AgentRelay } = await import('@agent-relay/sdk');
      const mockShutdown = vi.fn().mockResolvedValue(undefined);

      (AgentRelay as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
        shutdown: mockShutdown,
        spawn: vi.fn(),
        human: vi.fn().mockReturnValue({ name: 'PlannerCore', sendMessage: vi.fn() }),
        listAgents: vi.fn().mockResolvedValue([]),
        onMessageReceived: null,
        onAgentExited: null,
        onAgentSpawned: null,
        onAgentReady: null,
      }));

      const { connect, disconnect } = await import('./client.js');

      await connect();
      await disconnect();

      expect(mockShutdown).toHaveBeenCalled();
    });
  });

  describe('getRelay', () => {
    it('returns null before connect()', async () => {
      const { getRelay } = await import('./client.js');

      expect(getRelay()).toBeNull();
    });

    it('returns the AgentRelay instance after connect()', async () => {
      const { connect, getRelay } = await import('./client.js');

      await connect();

      expect(getRelay()).not.toBeNull();
    });
  });

  describe('spawnAgent', () => {
    it('throws when not connected', async () => {
      const { spawnAgent } = await import('./client.js');

      await expect(
        spawnAgent({ name: 'TestAgent', cli: 'claude', task: 'Do something' })
      ).rejects.toThrow('[relay] Cannot spawn agent: not connected');
    });
  });

  describe('sendMessage', () => {
    it('throws when not connected', async () => {
      const { sendMessage } = await import('./client.js');

      await expect(
        sendMessage('SomeAgent', 'hello')
      ).rejects.toThrow('[relay] Cannot send message: not connected');
    });
  });

  describe('onStateChange', () => {
    it('registers a callback and returns an unsubscribe function', async () => {
      const { onStateChange } = await import('./client.js');

      const callback = vi.fn();
      const unsubscribe = onStateChange(callback);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('unsubscribing prevents future state notifications', async () => {
      const { onStateChange, connect } = await import('./client.js');

      const callback = vi.fn();
      const unsubscribe = onStateChange(callback);
      unsubscribe();

      // connect() triggers a state change to 'connected'
      await connect();

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('relay/client (mode helpers)', () => {
  describe('isRelayAvailable', () => {
    it('returns false before connect() called', async () => {
      const { isRelayAvailable } = await import('./client.js');

      expect(isRelayAvailable()).toBe(false);
    });
  });

  describe('getRelayMode', () => {
    it('returns disconnected before connect() called', async () => {
      const { getRelayMode } = await import('./client.js');

      expect(getRelayMode()).toBe('disconnected');
    });
  });
});
