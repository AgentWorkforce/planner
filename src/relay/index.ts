/**
 * Relay Module - Public API
 *
 * Provides connection management and status checking for relay-daemon integration.
 */

// Client exports
export {
  connect,
  disconnect,
  destroy,
  isConnected,
  getConnectionState,
  getClient,
  onStateChange,
  type ClientState,
} from './client.js';

// Config exports
export {
  getRelayConfig,
  type RelayConfig,
} from './config.js';

// Service exports
export {
  isRelayAvailable,
  getRelayMode,
  onModeChange,
  setForceMockMode,
  type RelayMode,
} from './service.js';

// Spawner exports
export {
  spawnPlanningAgent,
  terminateAgent,
  createSpawner,
  getPlanningAgentPrompt,
  type SpawnContext,
  type SpawnResult,
  type Spawner,
} from './spawner.js';

// Mock spawner exports
export {
  createMockSpawner,
  isMockAgent,
  getActiveMockAgents,
  clearMockAgents,
} from './mock-spawner.js';

// Session timeout exports
export {
  checkSessionTimeouts,
  createSessionTimeoutService,
} from './session-timeout.js';
