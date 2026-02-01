import { useState, useCallback, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { useSessionEvents } from '@/hooks/useSessionEvents';
import { useSendMessage } from '@/hooks/useSendMessage';
import { TranscriptMessage } from '@/hooks/useIdeationApi';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { LoadingSpinner } from '@/components/ui';

interface SessionChatViewProps {
  sessionId: string;
}

export function SessionChatView({ sessionId }: SessionChatViewProps) {
  const { session, loading, error, refetch } = useSession(sessionId);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { send, sending } = useSendMessage(sessionId);

  // Handle real-time transcript updates
  const handleTranscriptUpdate = useCallback((messages: TranscriptMessage[]) => {
    setTranscript(messages);
    // Stop typing indicator when we receive a new assistant message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      setIsTyping(false);
    }
  }, []);

  // Subscribe to session events
  useSessionEvents(sessionId, {
    onTranscript: handleTranscriptUpdate,
    onStatus: (status) => {
      if (status === 'abandoned') {
        refetch();
      }
    },
  });

  // Initialize transcript from session data when loaded
  useEffect(() => {
    if (session?.transcript) {
      setTranscript(session.transcript);
    }
  }, [session?.transcript]);

  // Handle sending a new message
  const handleSend = useCallback(async (content: string) => {
    // Optimistically add user message to transcript
    const optimisticMessage: TranscriptMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setTranscript(prev => [...prev, optimisticMessage]);
    setIsTyping(true);

    const result = await send(content);
    if (!result) {
      // Remove optimistic message on failure
      setTranscript(prev => prev.slice(0, -1));
      setIsTyping(false);
    }
  }, [send]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="text-text-muted mt-4">Loading session...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-error mb-4">Failed to load session</p>
        <p className="text-text-muted text-sm">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // 404 state
  if (!session) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-text-primary text-lg mb-2">Session not found</p>
        <p className="text-text-muted text-sm">
          The session you're looking for doesn't exist or has been deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader session={session} />

      <div className="flex-1 overflow-hidden relative">
        <ChatMessageList messages={transcript} />
        {isTyping && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-bg-primary to-transparent">
            <TypingIndicator />
          </div>
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={sending || session.status === 'abandoned'}
        placeholder={
          session.status === 'abandoned'
            ? 'This session has been abandoned'
            : 'Type your message...'
        }
      />
    </div>
  );
}
