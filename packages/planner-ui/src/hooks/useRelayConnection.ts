/**
 * useRelayConnection Hook
 *
 * Manages WebSocket connection to the relay proxy endpoint (/ws/relay).
 * Handles connection lifecycle, reconnection, and message routing.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  RelayConnectionState,
  RelayMessage,
  PresenceEntry,
  BrowserOutgoingMessage,
  ServerIncomingMessage,
  UseRelayConnectionResult,
} from '@/types';

/** Max reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 5;

/** Delay between reconnection attempts (ms) */
const RECONNECT_DELAY_MS = 2000;

/** Heartbeat interval to keep connection alive (ms) */
const HEARTBEAT_INTERVAL_MS = 30000;

type MessageHandler = (message: RelayMessage) => void;
type JoinedHandler = (channelId: string, members: PresenceEntry[]) => void;
type LeftHandler = (channelId: string) => void;
type PresenceHandler = (channelId: string, members: PresenceEntry[]) => void;

/**
 * Hook for managing WebSocket connection to relay proxy.
 *
 * @param displayName - Display name for the user in relay
 * @param autoConnect - Whether to connect automatically (default: true)
 */
export function useRelayConnection(
  displayName: string = 'User',
  autoConnect: boolean = true
): UseRelayConnectionResult {
  const [state, setState] = useState<RelayConnectionState>('disconnected');
  const [isMock, setIsMock] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Event handlers registry
  const messageHandlersRef = useRef<Set<MessageHandler>>(new Set());
  const channelMessageHandlersRef = useRef<Set<MessageHandler>>(new Set());
  const joinedHandlersRef = useRef<Set<JoinedHandler>>(new Set());
  const leftHandlersRef = useRef<Set<LeftHandler>>(new Set());
  const presenceHandlersRef = useRef<Set<PresenceHandler>>(new Set());

  // Cleanup function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Send message over WebSocket
  const send = useCallback((message: BrowserOutgoingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    cleanup();
    setState('connecting');
    setError(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/relay?name=${encodeURIComponent(displayName)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setState('connected');
      setError(null);
      reconnectAttemptsRef.current = 0;

      // Start heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerIncomingMessage;

        switch (data.type) {
          case 'status':
            setIsMock(data.mode === 'mock');
            if (data.userId) {
              setUserId(data.userId);
            }
            break;

          case 'message': {
            const msg: RelayMessage = {
              id: data.id || crypto.randomUUID(),
              from: data.from || 'unknown',
              fromName: data.fromName || data.from || 'Unknown',
              entityType: data.entityType || 'agent',
              body: data.body || '',
              timestamp: data.timestamp || new Date().toISOString(),
              data: data.data,
            };
            messageHandlersRef.current.forEach((handler) => handler(msg));
            break;
          }

          case 'channel_message': {
            const msg: RelayMessage = {
              id: data.id || crypto.randomUUID(),
              from: data.from || 'unknown',
              fromName: data.fromName || data.from || 'Unknown',
              entityType: data.entityType || 'agent',
              channel: data.channel,
              body: data.body || '',
              timestamp: data.timestamp || new Date().toISOString(),
              data: data.data,
            };
            channelMessageHandlersRef.current.forEach((handler) => handler(msg));
            break;
          }

          case 'joined':
            if (data.channel) {
              joinedHandlersRef.current.forEach((handler) =>
                handler(data.channel!, data.members || [])
              );
            }
            break;

          case 'left':
            if (data.channel) {
              leftHandlersRef.current.forEach((handler) => handler(data.channel!));
            }
            break;

          case 'error':
            setError(data.error || 'Unknown error');
            break;
        }
      } catch (err) {
        console.error('[useRelayConnection] Failed to parse message:', err);
      }
    };

    ws.onerror = () => {
      setError('Connection error');
    };

    ws.onclose = () => {
      cleanup();
      setState('disconnected');

      // Attempt reconnection if under max attempts
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        setState('reconnecting');
        setError(`Reconnecting (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, RECONNECT_DELAY_MS * reconnectAttemptsRef.current);
      } else {
        setState('error');
        setError('Failed to connect after multiple attempts');
      }
    };
  }, [displayName, cleanup]);

  // Reconnect manually
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Channel operations
  const joinChannel = useCallback(
    (channelId: string) => {
      send({ type: 'join', channel: channelId });
    },
    [send]
  );

  const leaveChannel = useCallback(
    (channelId: string) => {
      send({ type: 'leave', channel: channelId });
    },
    [send]
  );

  const sendChannelMessage = useCallback(
    (channelId: string, body: string, data?: Record<string, unknown>) => {
      send({ type: 'send', channel: channelId, body, data });
    },
    [send]
  );

  const sendDirectMessage = useCallback(
    (to: string, body: string, data?: Record<string, unknown>) => {
      send({ type: 'dm', to, body, data });
    },
    [send]
  );

  // Event subscription helpers
  const onMessage = useCallback((handler: MessageHandler) => {
    messageHandlersRef.current.add(handler);
    return () => {
      messageHandlersRef.current.delete(handler);
    };
  }, []);

  const onChannelMessage = useCallback((handler: MessageHandler) => {
    channelMessageHandlersRef.current.add(handler);
    return () => {
      channelMessageHandlersRef.current.delete(handler);
    };
  }, []);

  const onJoined = useCallback((handler: JoinedHandler) => {
    joinedHandlersRef.current.add(handler);
    return () => {
      joinedHandlersRef.current.delete(handler);
    };
  }, []);

  const onLeft = useCallback((handler: LeftHandler) => {
    leftHandlersRef.current.add(handler);
    return () => {
      leftHandlersRef.current.delete(handler);
    };
  }, []);

  const onPresenceUpdate = useCallback((handler: PresenceHandler) => {
    presenceHandlersRef.current.add(handler);
    return () => {
      presenceHandlersRef.current.delete(handler);
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return cleanup;
  }, [autoConnect, connect, cleanup]);

  return {
    state,
    isConnected: state === 'connected',
    isMock,
    userId,
    joinChannel,
    leaveChannel,
    sendChannelMessage,
    sendDirectMessage,
    onMessage,
    onChannelMessage,
    onJoined,
    onLeft,
    onPresenceUpdate,
    error,
    reconnect,
  };
}
