/**
 * useChannelMessages Hook
 *
 * Manages messages for a specific channel.
 * Receives real-time messages and can load history.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { get } from '@/api/client';
import type { RelayMessage, UseChannelMessagesResult, UseRelayConnectionResult } from '@/types';

interface MessagesResponse {
  messages: RelayMessage[];
}

/** Maximum messages to keep in memory */
const MAX_MESSAGES = 200;

/**
 * Hook for managing channel messages.
 *
 * @param connection - The relay connection from useRelayConnection
 * @param channelId - Channel ID to track messages for (null to disable)
 * @param loadHistory - Whether to load message history on mount (default: true)
 */
export function useChannelMessages(
  connection: UseRelayConnectionResult,
  channelId: string | null,
  loadHistory: boolean = true
): UseChannelMessagesResult {
  const [messages, setMessages] = useState<RelayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track channel to avoid stale closures
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;

  // Load message history from REST API
  const loadMessageHistory = useCallback(async () => {
    if (!channelId) return;

    setIsLoading(true);
    setError(null);

    try {
      const encodedChannel = encodeURIComponent(channelId);
      const response = await get<MessagesResponse>(`/channels/${encodedChannel}/messages`);
      setMessages(response.messages);
    } catch (err) {
      // History fetch failure is not critical - we'll get messages from WebSocket
      console.warn('[useChannelMessages] Failed to load history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  // Add a message to the list
  const addMessage = useCallback((message: RelayMessage) => {
    setMessages((prev) => {
      // Dedupe by message ID
      if (prev.some((m) => m.id === message.id)) {
        return prev;
      }

      // Add message and trim if needed
      const next = [...prev, message];
      if (next.length > MAX_MESSAGES) {
        return next.slice(next.length - MAX_MESSAGES);
      }
      return next;
    });
  }, []);

  // Send a message to the channel with optimistic update
  const send = useCallback(
    (body: string, data?: Record<string, unknown>) => {
      if (!channelIdRef.current || !connection.isConnected) return;

      // Optimistic update: add message immediately to UI
      const optimisticMessage: RelayMessage = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        from: connection.userId || 'user',
        fromName: 'You',
        entityType: 'user',
        channel: channelIdRef.current,
        body,
        timestamp: new Date().toISOString(),
        data,
      };
      addMessage(optimisticMessage);

      // Send to relay
      connection.sendChannelMessage(channelIdRef.current, body, data);
    },
    [connection, addMessage]
  );

  // Clear all messages
  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  // Subscribe to channel messages
  useEffect(() => {
    const unsubscribe = connection.onChannelMessage((message) => {
      // Only add messages for our channel
      if (message.channel === channelIdRef.current) {
        addMessage(message);
      }
    });

    return unsubscribe;
  }, [connection, addMessage]);

  // Load history when channel changes (or clear if no channel)
  useEffect(() => {
    // Clear previous messages and error when channel changes
    setMessages([]);
    setError(null);

    if (loadHistory && channelId) {
      loadMessageHistory();
    }
  }, [channelId, loadHistory, loadMessageHistory]);

  return {
    messages,
    isLoading,
    error,
    send,
    clear,
  };
}
