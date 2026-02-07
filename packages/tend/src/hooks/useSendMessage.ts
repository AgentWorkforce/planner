import { useState, useCallback, useRef } from 'react';
import { TranscriptMessage, useIdeationApi } from './useIdeationApi';

interface UseSendMessageResult {
  send: (content: string) => Promise<TranscriptMessage | null>;
  sending: boolean;
}

export function useSendMessage(
  sessionId: string | undefined,
  focusedBlockId?: string,
  onOptimisticAdd?: (message: TranscriptMessage) => void
): UseSendMessageResult {
  const [sending, setSending] = useState(false);
  const { sendMessage } = useIdeationApi();

  // Use refs to get stable references
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  const onOptimisticAddRef = useRef(onOptimisticAdd);
  onOptimisticAddRef.current = onOptimisticAdd;

  const send = useCallback(async (content: string): Promise<TranscriptMessage | null> => {
    if (!sessionId || !content.trim()) return null;

    // Optimistically add user message
    const optimisticMessage: TranscriptMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    onOptimisticAddRef.current?.(optimisticMessage);

    setSending(true);
    try {
      const result = await sendMessageRef.current(sessionId, content.trim(), focusedBlockId);
      return result;
    } finally {
      setSending(false);
    }
  }, [sessionId, focusedBlockId]);

  return {
    send,
    sending,
  };
}
