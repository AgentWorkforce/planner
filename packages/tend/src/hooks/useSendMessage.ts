import { useState, useCallback, useRef } from 'react';
import { TranscriptMessage, useIdeationApi } from './useIdeationApi';

interface UseSendMessageResult {
  /** Sends a message and returns the full updated transcript from the server, or null on failure. */
  send: (content: string) => Promise<TranscriptMessage[] | null>;
  sending: boolean;
}

export function useSendMessage(
  sessionId: string | undefined,
  focusedBlockId?: string,
): UseSendMessageResult {
  const [sending, setSending] = useState(false);
  const { sendMessage } = useIdeationApi();

  // Use refs to get stable references
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  const send = useCallback(async (content: string): Promise<TranscriptMessage[] | null> => {
    if (!sessionId || !content.trim()) return null;

    setSending(true);
    try {
      // Returns the full updated transcript (including assistant response) from the API
      const transcript = await sendMessageRef.current(sessionId, content.trim(), focusedBlockId);
      return transcript;
    } finally {
      setSending(false);
    }
  }, [sessionId, focusedBlockId]);

  return {
    send,
    sending,
  };
}
