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
  getRelay,
  getAgentHandle,
  onStateChange,
  onMessage,
  onAgentExited,
  spawnAgent,
  releaseAgent,
  removeAgent,
  setAgentModel,
  getSpawnedAgents,
  isAgentSpawned,
  getSpawnedAgentChannel,
  getConnectionMetrics,
  sendMessage,
  sendChannelMessage,
  type ConnectionState,
  type ConnectionMetrics,
  type SpawnAgentOptions,
  type SpawnResult as RelaySpawnResult,
  type AgentExitInfo,
  type SetModelResult,
} from './client.js';

// Config exports
export {
  getRelayConfig,
  type RelayConfig,
} from './config.js';

// Relay mode exports (formerly in service.ts)
export {
  isRelayAvailable,
  getRelayMode,
  type RelayMode,
} from './client.js';

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

// Session timeout exports
export {
  checkSessionTimeouts,
  createSessionTimeoutService,
} from './session-timeout.js';

// WebSocket proxy exports
export {
  initWebSocketProxy,
  getActiveConnections,
  broadcastToUsers,
} from './ws-proxy.js';

// Channel management exports
export {
  PLANNER_CHANNEL,
  getPlanChannelId,
  createPlannerChannel,
  createPlanChannel,
  removePlanChannel,
  getChannelsForUser,
  channelExists,
  getAllChannels,
  initChannelManagement,
  registerPlanChannels,
  ensurePlanChannelJoined,
  type ChannelInfo,
} from './channels.js';

// Ideation bridge exports
export {
  initIdeationBridge,
  stopIdeationBridge,
  syncIdeationSessionChannels,
} from './ideation-bridge.js';

// Plan channel middleware exports
export { planChannelMiddleware } from './plan-channel-middleware.js';

// QA channel middleware exports
export { qaChannelMiddleware } from './qa-channel-middleware.js';

// Agent status exports
export {
  getActiveAgents,
  emitAgentJoined,
  emitAgentStatusUpdate,
  emitAgentLeft,
  emitAgentsSnapshot,
  emitAgentParked,
  emitAgentWarming,
  setPendingModel,
  type AgentState,
  type AgentRole,
  type AgentJoinedEvent,
  type AgentStatusUpdateEvent,
  type AgentLeftEvent,
  type AgentsSnapshotEvent,
  type AgentParkedEvent,
  type AgentWarmingEvent,
  type AgentStatusEvent,
} from './agent-status.js';

// Session presence exports
export {
  addWatcher,
  removeWatcher,
  setAgentForSession,
  initSessionPresence,
  getAgentLifecycleState,
  getSessionPresence,
  getAllPresence,
} from './session-presence.js';
