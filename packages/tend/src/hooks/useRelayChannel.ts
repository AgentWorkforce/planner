import { useState, useEffect, useCallback, useRef } from 'react';
import { useRelay } from '@/contexts/RelayContext';
import type { RelayMessage } from '@/types/relay';

interface MessagesResponse {
  messages: RelayMessage[];
}

const MAX_MESSAGES = 200;
const FLUSH_TIMEOUT_MS = 60_000;

export interface UseRelayChannelResult {
  messages: RelayMessage[];
  isLoading: boolean;
  send: (content: string) => void;
  unreadCount: number;
  queuedCount: number;
  removeFromQueue: (messageId: string) => void;
  markRead: () => void;
  setActive: (active: boolean) => void;
}

/**
 * Generic hook for relay channel messaging.
 * Handles channel join/leave, message history, real-time updates, unread tracking,
 * and message queuing (delivers user messages one at a time when agent is busy).
 */
export function useRelayChannel(options: {
  channelId: string | undefined;
  skipHistory?: boolean;
}): UseRelayChannelResult {
  const { channelId } = options;
  const { connection } = useRelay();
  const [messages, setMessages] = useState<RelayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const channelIdRef = useRef<string | null>(null);
  const isActiveRef = useRef(false);
  channelIdRef.current = channelId || null;

  // Message queue: holds messages waiting to be sent to the agent
  const queueRef = useRef<{ id: string; content: string }[]>([]);
  const agentIsBusyRef = useRef(false);
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlushTimeout = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  }, []);

  const loadMessageHistory = useCallback(async () => {
    if (!channelId) return;
    setIsLoading(true);
    try {
      const encodedChannel = encodeURIComponent(channelId);
      const response = await fetch(`/api/channels/${encodedChannel}/messages`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = (await response.json()) as MessagesResponse;
      setMessages(data.messages || []);
    } catch (err) {
      console.warn('[useRelayChannel] Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  const addMessage = useCallback((message: RelayMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      const next = [...prev, message];
      if (next.length > MAX_MESSAGES) return next.slice(next.length - MAX_MESSAGES);
      return next;
    });
    if (!isActiveRef.current) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  /**
   * Send the next queued message to the relay (one at a time).
   * If the queue is empty, mark the agent as idle.
   */
  const flushNext = useCallback(() => {
    if (!channelIdRef.current || !connection.isConnected) return;

    const next = queueRef.current.shift();
    if (!next) {
      // Queue empty — agent is truly idle
      agentIsBusyRef.current = false;
      setQueuedCount(0);
      return;
    }

    // Send this one message
    connection.sendChannelMessage(channelIdRef.current, next.content);
    setQueuedCount(queueRef.current.length);

    // Clear the queued flag on the optimistic message
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === next.id ? { ...msg, data: undefined } : msg
      )
    );

    // Agent stays busy processing the just-sent message, restart timeout
    agentIsBusyRef.current = true;
    clearFlushTimeout();
    flushTimeoutRef.current = setTimeout(() => {
      // Agent didn't respond in time — try sending the next one anyway
      flushNext();
    }, FLUSH_TIMEOUT_MS);
  }, [connection, clearFlushTimeout]);

  const send = useCallback(
    (content: string) => {
      if (!channelIdRef.current || !connection.isConnected) return;

      const messageId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const optimisticMessage: RelayMessage = {
        id: messageId,
        from: connection.userId || 'user',
        fromName: 'You',
        entityType: 'user',
        channelId: channelIdRef.current,
        content,
        timestamp: new Date().toISOString(),
        data: agentIsBusyRef.current ? { queued: true } : undefined,
      };

      addMessage(optimisticMessage);

      if (agentIsBusyRef.current) {
        // Agent is busy — queue for later delivery
        queueRef.current.push({ id: messageId, content });
        setQueuedCount(queueRef.current.length);
      } else {
        // Agent is idle — send immediately
        connection.sendChannelMessage(channelIdRef.current, content);
        agentIsBusyRef.current = true;
        clearFlushTimeout();
        flushTimeoutRef.current = setTimeout(() => {
          flushNext();
        }, FLUSH_TIMEOUT_MS);
      }
    },
    [connection, addMessage, clearFlushTimeout, flushNext]
  );

  const removeFromQueue = useCallback((messageId: string) => {
    queueRef.current = queueRef.current.filter((entry) => entry.id !== messageId);
    setQueuedCount(queueRef.current.length);
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  }, []);

  const markRead = useCallback(() => { setUnreadCount(0); }, []);
  const setActive = useCallback((active: boolean) => {
    isActiveRef.current = active;
    if (active) setUnreadCount(0);
  }, []);

  useEffect(() => {
    if (!channelId || !connection.isConnected) return;
    connection.joinChannel(channelId);
    return () => { connection.leaveChannel(channelId); };
  }, [channelId, connection]);

  // Reset all state on channel change
  useEffect(() => {
    setMessages([]);
    setUnreadCount(0);
    queueRef.current = [];
    agentIsBusyRef.current = false;
    setQueuedCount(0);
    clearFlushTimeout();
    if (channelId && !options.skipHistory) loadMessageHistory();
  }, [channelId, loadMessageHistory, clearFlushTimeout]);

  // Listen for incoming messages — detect agent responses to flush queue
  useEffect(() => {
    const unsubscribe = connection.onChannelMessage((message) => {
      if (message.channelId !== channelIdRef.current) return;

      addMessage(message);

      // Check if this is an agent content message (triggers queue flush)
      const dataType = message.data?.type as string | undefined;
      const isAgentContent =
        message.entityType === 'agent' &&
        dataType !== 'tool_action' &&
        dataType !== 'thinking' &&
        !!message.content;

      if (isAgentContent && agentIsBusyRef.current) {
        clearFlushTimeout();
        flushNext();
      }
    });
    return unsubscribe;
  }, [connection, addMessage, clearFlushTimeout, flushNext]);

  const noopResult: UseRelayChannelResult = {
    messages: [], isLoading: false, send: () => {}, unreadCount: 0,
    queuedCount: 0, removeFromQueue: () => {}, markRead: () => {}, setActive: () => {},
  };

  if (!channelId) return noopResult;

  return { messages, isLoading, send, unreadCount, queuedCount, removeFromQueue, markRead, setActive };
}
