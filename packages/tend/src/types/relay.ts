export type RelayEntityType = 'user' | 'agent';

export type RelayConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface PresenceEntry {
  userId: string;
  name: string;
  entityType: RelayEntityType;
  joinedAt: string;
}

export interface RelayMessage {
  id: string;
  from: string;
  fromName: string;
  entityType: RelayEntityType;
  channelId?: string;
  content: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface BrowserOutgoingMessage {
  type: 'join' | 'leave' | 'send' | 'dm' | 'ping';
  channel?: string;
  to?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export interface ServerIncomingMessage {
  type: 'status' | 'message' | 'channel_message' | 'joined' | 'left' | 'error';
  mode?: 'real' | 'mock';
  userId?: string;
  id?: string;
  from?: string;
  fromName?: string;
  entityType?: RelayEntityType;
  channel?: string;
  body?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
  members?: PresenceEntry[];
  error?: string;
}

export interface UseRelayConnectionResult {
  state: RelayConnectionState;
  isConnected: boolean;
  isMock: boolean;
  userId: string | null;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  sendChannelMessage: (channelId: string, content: string, data?: Record<string, unknown>) => void;
  sendDirectMessage: (to: string, content: string, data?: Record<string, unknown>) => void;
  onMessage: (handler: (message: RelayMessage) => void) => () => void;
  onChannelMessage: (handler: (message: RelayMessage) => void) => () => void;
  onJoined: (handler: (channelId: string, members: PresenceEntry[]) => void) => () => void;
  onLeft: (handler: (channelId: string) => void) => () => void;
  onPresenceUpdate: (handler: (channelId: string, members: PresenceEntry[]) => void) => () => void;
  error: string | null;
  reconnect: () => void;
}
