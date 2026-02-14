import { useState, useEffect, useMemo } from 'react';
import { useRelayChannel } from './useRelayChannel';
import type { UseRelayChannelResult } from './useRelayChannel';
import type { RelayMessage } from '@/types/relay';

interface TranscriptMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

/**
 * Convert ideation transcript messages to RelayMessage format.
 * System messages (tool_action, thinking) carry their data through.
 */
function transcriptToRelay(messages: TranscriptMessage[], channelId: string): RelayMessage[] {
  return messages.map((msg) => ({
    id: `transcript-${msg.id}`,
    from: msg.role === 'user' ? 'user' : 'Interviewer',
    fromName: msg.role === 'user' ? 'You' : 'Interviewer',
    entityType: msg.role === 'user' ? 'user' as const : 'agent' as const,
    channelId,
    content: msg.content,
    timestamp: msg.timestamp,
    data: msg.data,
  }));
}

/**
 * Relay channel hook for ideation sessions.
 *
 * Loads the session transcript from ideation storage as initial history,
 * then appends real-time relay messages on top. This ensures chat history
 * survives relay daemon restarts (relay channel messages are ephemeral,
 * but the session transcript in ideation.db is persistent).
 */
export function useSessionChannel(sessionId: string | undefined): UseRelayChannelResult {
  const channelId = sessionId ? `#ideation-${sessionId.slice(0, 8)}` : undefined;
  const relay = useRelayChannel({ channelId, skipHistory: true });
  const [transcriptMessages, setTranscriptMessages] = useState<RelayMessage[]>([]);

  // Fetch session transcript as initial history
  useEffect(() => {
    if (!sessionId) {
      setTranscriptMessages([]);
      return;
    }

    fetch(`/api/ideation/sessions/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((session: { transcript?: TranscriptMessage[] }) => {
        if (session.transcript?.length && channelId) {
          setTranscriptMessages(transcriptToRelay(session.transcript, channelId));
        }
      })
      .catch((err) => {
        console.warn('[useSessionChannel] Failed to load transcript:', err);
      });
  }, [sessionId, channelId]);

  // Merge transcript history + relay real-time messages.
  // Transcript IDs are prefixed with "transcript-" so no collision with relay IDs.
  const messages = useMemo(() => {
    if (transcriptMessages.length === 0) return relay.messages;
    if (relay.messages.length === 0) return transcriptMessages;
    return [...transcriptMessages, ...relay.messages];
  }, [transcriptMessages, relay.messages]);

  return { ...relay, messages };
}
