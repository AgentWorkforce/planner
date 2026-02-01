import { useState, useCallback } from 'react';
import { TranscriptMessage, useIdeationApi } from './useIdeationApi';

interface UseSendMessageResult {
  send: (content: string) => Promise<TranscriptMessage | null>;
  sending: boolean;
}

export function useSendMessage(
  sessionId: string | undefined,
  onOptimisticAdd?: (message: TranscriptMessage) => void
): UseSendMessageResult {
  const [sending, setSending] = useState(false);
  const api = useIdeationApi();

  const send = useCallback(async (content: string): Promise<TranscriptMessage | null> => {
    if (!sessionId || !content.trim()) return null;

    // Optimistically add user message
    const optimisticMessage: TranscriptMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    onOptimisticAdd?.(optimisticMessage);

    setSending(true);
    try {
      const result = await api.sendMessage(sessionId, content.trim());
      return result;
    } finally {
      setSending(false);
    }
  }, [sessionId, api, onOptimisticAdd]);

  return {
    send,
    sending,
  };
}
