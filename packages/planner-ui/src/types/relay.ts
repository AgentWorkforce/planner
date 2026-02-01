/**
 * Relay Messaging Types
 *
 * Types for the channel-based messaging system that integrates
 * with agent-relay for real-time agent communication.
 */

import type { QuestionBlockingLevel } from './plan';

/** Entity types in relay system */
export type RelayEntityType = 'user' | 'agent';

/** Connection state for WebSocket */
export type RelayConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/** Channel types */
export type ChannelType = 'global' | 'plan' | 'dm';

/** Channel info from REST API */
export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  planId?: string;
  description?: string;
  agentId?: string;    // For DM channels: the agent's ID
  agentName?: string;  // For DM channels: the agent's display name
}

/** Entity present in a channel */
export interface PresenceEntry {
  id: string;
  name: string;
  entityType: RelayEntityType;
  joinedAt: string;
}

/** Message in a channel or DM */
export interface RelayMessage {
  id: string;
  from: string;
  fromName: string;
  entityType: RelayEntityType;
  channel?: string;
  body: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/** Browser -> Server message format */
export interface BrowserOutgoingMessage {
  type: 'join' | 'leave' | 'send' | 'dm';
  channel?: string;
  to?: string;
  body?: string;
  data?: Record<string, unknown>;
}

/** Server -> Browser message format */
export interface ServerIncomingMessage {
  type: 'message' | 'channel_message' | 'status' | 'error' | 'joined' | 'left';
  channel?: string;
  from?: string;
  fromName?: string;
  entityType?: RelayEntityType;
  body?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
  id?: string;
  connected?: boolean;
  mode?: 'real' | 'mock';
  userId?: string;
  error?: string;
  members?: PresenceEntry[];
}

/** Hook return for useRelayConnection */
export interface UseRelayConnectionResult {
  /** Current connection state */
  state: RelayConnectionState;
  /** Whether connected (state === 'connected') */
  isConnected: boolean;
  /** Whether in mock mode (simulated responses) */
  isMock: boolean;
  /** User ID assigned by server */
  userId: string | null;
  /** Join a channel */
  joinChannel: (channelId: string) => void;
  /** Leave a channel */
  leaveChannel: (channelId: string) => void;
  /** Send message to a channel */
  sendChannelMessage: (channelId: string, body: string, data?: Record<string, unknown>) => void;
  /** Send direct message to an entity */
  sendDirectMessage: (to: string, body: string, data?: Record<string, unknown>) => void;
  /** Subscribe to incoming messages */
  onMessage: (handler: (message: RelayMessage) => void) => () => void;
  /** Subscribe to channel messages */
  onChannelMessage: (handler: (message: RelayMessage) => void) => () => void;
  /** Subscribe to join events */
  onJoined: (handler: (channelId: string, members: PresenceEntry[]) => void) => () => void;
  /** Subscribe to leave events */
  onLeft: (handler: (channelId: string) => void) => () => void;
  /** Subscribe to presence updates */
  onPresenceUpdate: (handler: (channelId: string, members: PresenceEntry[]) => void) => () => void;
  /** Last error message */
  error: string | null;
  /** Force reconnect */
  reconnect: () => void;
}

/** Hook return for useChannels */
export interface UseChannelsResult {
  /** List of available channels */
  channels: Channel[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh channel list */
  refresh: () => void;
  /** Currently joined channels */
  joinedChannels: Set<string>;
  /** Join a channel */
  join: (channelId: string) => void;
  /** Leave a channel */
  leave: (channelId: string) => void;
}

/** Hook return for useChannelMessages */
export interface UseChannelMessagesResult {
  /** Messages in current channel */
  messages: RelayMessage[];
  /** Whether loading history */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Send a message */
  send: (body: string, data?: Record<string, unknown>) => void;
  /** Clear messages */
  clear: () => void;
}

/** Hook return for usePresence */
export interface UsePresenceResult {
  /** Members present in channel */
  members: PresenceEntry[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh presence list */
  refresh: () => void;
}

/** QA message payload (answered question notification) */
export interface QAMessagePayload {
  type: 'qa';
  questionId: string;
  questionText: string;
  answerText: string;
  agentName: string;
  agentRole: string;
  blockingLevel: QuestionBlockingLevel;
  answeredAt: string;
}

/** Type guard for QA message payload */
export function isQAMessage(data: unknown): data is QAMessagePayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    (data as QAMessagePayload).type === 'qa'
  );
}
