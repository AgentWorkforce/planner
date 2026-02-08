import { useState, useCallback, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { useSessionEvents } from '@/hooks/useSessionEvents';
import { useSendMessage } from '@/hooks/useSendMessage';
import { TranscriptMessage } from '@/hooks/useIdeationApi';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { LoadingSpinner } from '@/components/ui';
import { MessageSquare } from 'lucide-react';

interface SessionChatViewProps {
  sessionId: string;
  /** Optional block ID for contextual chat mode */
  focusedBlockId?: string;
  /** Optional block data for display in context banner */
  focusedBlock?: {
    id: string;
    emoji: string;
    keyword: string;
  };
}

export function SessionChatView({ sessionId, focusedBlockId, focusedBlock }: SessionChatViewProps) {
  const { session, loading, error, refetch } = useSession(sessionId);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { send, sending } = useSendMessage(sessionId, focusedBlockId);

  // Handle real-time transcript updates
  const handleTranscriptUpdate = useCallback((messages: TranscriptMessage[]) => {
    console.log(`[SessionChatView] handleTranscriptUpdate called with ${messages?.length || 0} messages`);
    setTranscript(messages);
    // Stop typing indicator when we receive a new assistant message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      console.log(`[SessionChatView] Received assistant message, stopping typing indicator`);
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

    // send() returns the full updated transcript from the API (including assistant response)
    const updatedTranscript = await send(content);
    if (!updatedTranscript) {
      // Remove optimistic message on failure
      setTranscript(prev => prev.slice(0, -1));
    } else {
      // Use the server transcript directly — includes both the user message and assistant response
      setTranscript(updatedTranscript);
    }
    setIsTyping(false);
  }, [send]);

  // Handle selecting a multiple choice option
  const handleSelectOption = useCallback(async (optionId: string) => {
    // Find the option label to send as the message content
    const lastMessage = transcript[transcript.length - 1];
    const option = lastMessage?.multiple_choice?.options.find(opt => opt.id === optionId);

    if (!option) return;

    // Mark the option as selected in the transcript
    setTranscript(prev => prev.map((msg, idx) => {
      if (idx === prev.length - 1 && msg.multiple_choice) {
        return {
          ...msg,
          multiple_choice: {
            ...msg.multiple_choice,
            selected_id: optionId,
          },
        };
      }
      return msg;
    }));

    // Send the selected option label as a user message
    await handleSend(option.label);
  }, [transcript, handleSend]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <LoadingSpinner size="lg" />
        <p className="text-text-muted mt-4">Opening conversation...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-error mb-4">Lost connection to session</p>
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
        <p className="text-text-primary text-lg mb-2">Session has withered</p>
        <p className="text-text-muted text-sm">
          The session you're looking for doesn't exist or has been deleted.
        </p>
      </div>
    );
  }

  // Determine the placeholder based on mode and session status
  const getPlaceholder = () => {
    if (session.status === 'abandoned') {
      return 'This session was released';
    }
    if (focusedBlockId && focusedBlock) {
      return `Ask about "${focusedBlock.keyword}"...`;
    }
    return 'Type your message...';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Context Banner for Focus Mode */}
      {focusedBlockId && focusedBlock && (
        <div className="flex items-center justify-between px-4 py-3 bg-accent-cyan/10 border-b border-accent-cyan/20">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent-cyan" />
            <span className="text-sm text-text-primary font-medium">
              Contextual Chat
            </span>
            <span className="text-xs text-text-muted">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-base" aria-hidden="true">
                {focusedBlock.emoji}
              </span>
              <span className="text-sm text-text-muted">
                {focusedBlock.keyword}
              </span>
            </div>
          </div>
          <div className="text-xs text-text-muted">
            Messages are scoped to this block
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto relative">
        <ChatMessageList
          messages={transcript}
          onSelectOption={handleSelectOption}
        />
        {isTyping && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[var(--canvas-bg)] to-transparent">
            <TypingIndicator />
          </div>
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={sending || session.status === 'abandoned'}
        placeholder={getPlaceholder()}
      />
    </div>
  );
}
