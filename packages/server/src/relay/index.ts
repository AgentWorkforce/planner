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
  spawnAgent,
  releaseAgent,
  getSpawnedAgents,
  isAgentSpawned,
  sendMessage,
  sendChannelMessage,
  type ClientState,
  type SpawnAgentOptions,
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
  syncPlanChannels,
  type ChannelInfo,
} from './channels.js';

// PlannerLead exports
export {
  spawnPlannerLead,
  terminatePlannerLead,
  isPlannerLeadActive,
  getPlannerLeadAgentId,
  joinPlannerLeadToChannel,
  initPlannerLead,
  stopPlannerLead,
  notifyNewPlan,
} from './planner-lead.js';

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
  type AgentState,
  type AgentRole,
  type AgentJoinedEvent,
  type AgentStatusUpdateEvent,
  type AgentLeftEvent,
  type AgentsSnapshotEvent,
  type AgentStatusEvent,
} from './agent-status.js';

// Chat exports
export {
  sendToAgent,
  type AgentResponse,
} from './chat.js';
