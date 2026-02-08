import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { useSendMessage } from '@/hooks/useSendMessage';
import { TranscriptMessage } from '@/hooks/useIdeationApi';
import { ConversationMessages, ConversationItem } from './ConversationMessages';
import { ConversationInput } from './ConversationInput';
import { AgentTabBar } from './AgentTabBar';
import { TypingIndicator } from '../chat/TypingIndicator';
import { LoadingSpinner } from '@/components/ui';
import { MessageSquare, X } from 'lucide-react';
import { ReplyBar, PendingItem } from '../status/ReplyBar';

interface QuickActionsProps {
  phase: string;
  hasBlocks: boolean;
  hasSteps: boolean;
  onAction: (text: string) => void;
}

function QuickActions({ phase, hasBlocks, hasSteps, onAction }: QuickActionsProps) {
  // Contextual suggestions based on state
  const suggestions: string[] = [];

  if (phase === 'ideation') {
    if (!hasBlocks) {
      suggestions.push('What are the main features?', 'Help me brainstorm', 'What should we build first?');
    } else {
      suggestions.push('What needs more detail?', 'Are we ready to plan?', 'Show me the blocks');
    }
  } else if (phase === 'planning') {
    if (!hasSteps) {
      suggestions.push('Create steps from blocks', 'What dependencies exist?', 'Estimate complexity');
    } else {
      suggestions.push('Review the plan', 'Check acceptance criteria', 'Ready to execute?');
    }
  } else if (phase === 'forging') {
    suggestions.push('What\'s the current status?', 'Any blockers?', 'Show progress');
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide">
      {suggestions.map((text) => (
        <button
          key={text}
          onClick={() => onAction(text)}
          className="shrink-0 px-3 py-1 text-xs text-text-muted hover:text-text-secondary bg-bg-tertiary/50 hover:bg-bg-tertiary rounded-full transition-colors whitespace-nowrap"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

interface ConversationPaneProps {
  sessionId: string;
  /** Optional block ID for contextual chat mode */
  focusedBlockId?: string;
  /** Optional block data for display in context banner */
  focusedBlock?: {
    id: string;
    emoji: string;
    keyword: string;
  };
  /** Active agents (for tab bar) */
  agents?: Array<{
    id: string;
    name: string;
    role: string;
    status: 'active' | 'completed' | 'blocked';
    unreadCount?: number;
  }>;
  /** Pending items requiring user attention */
  pendingItems?: PendingItem[];
  /** Handler for replying to a pending item */
  onReplyItem?: (itemId: string) => void;
  /** Handler for dismissing a pending item */
  onDismissItem?: (itemId: string) => void;
  /** Current project phase */
  phase?: string;
  /** Whether blocks exist */
  hasBlocks?: boolean;
  /** Whether steps exist */
  hasSteps?: boolean;
  /** Key that triggers transcript refetch when incremented (from ProjectContext SSE) */
  transcriptRefreshKey?: number;
}

export function ConversationPane({
  sessionId,
  focusedBlockId,
  focusedBlock,
  agents = [],
  pendingItems,
  onReplyItem,
  onDismissItem,
  phase = 'ideation',
  hasBlocks = false,
  hasSteps = false,
  transcriptRefreshKey,
}: ConversationPaneProps) {
  const { session, loading, error, refetch } = useSession(sessionId);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { send, sending } = useSendMessage(sessionId, focusedBlockId);
  const [, setSearchParams] = useSearchParams();
  const [showReconnected, setShowReconnected] = useState(false);
  const wasDisconnectedRef = useRef(false);
  const hasLoadedOnceRef = useRef(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);

  // Tab management - channel_id filtering
  const [activeChannelId, setActiveChannelId] = useState<string>('main');

  // Handler for clearing focus
  const handleClearFocus = useCallback(() => {
    setSearchParams(params => {
      params.delete('focus');
      params.set('zoom', 'overview');
      return params;
    });
  }, [setSearchParams]);

  // Refetch session when transcriptRefreshKey changes (driven by ProjectContext SSE)
  // This replaces the per-component SSE subscription to avoid browser connection exhaustion
  const transcriptRefreshKeyRef = useRef(transcriptRefreshKey);
  useEffect(() => {
    if (transcriptRefreshKeyRef.current !== undefined && transcriptRefreshKey !== transcriptRefreshKeyRef.current) {
      console.log(`[ConversationPane] Transcript refresh triggered (key: ${transcriptRefreshKey})`);
      refetch();
    }
    transcriptRefreshKeyRef.current = transcriptRefreshKey;
  }, [transcriptRefreshKey, refetch]);

  // Initialize transcript from session data when loaded
  useEffect(() => {
    if (session?.transcript) {
      setTranscript(session.transcript);
    }
  }, [session?.transcript]);

  // Track disconnection and show "Welcome back" banner on reconnection
  // Skip the initial load — only show on actual reconnections
  useEffect(() => {
    if (loading) {
      if (hasLoadedOnceRef.current) {
        wasDisconnectedRef.current = true;
      }
    } else if (session) {
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
      } else if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        setShowReconnected(true);
        const timer = setTimeout(() => setShowReconnected(false), 3000);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [loading, session]);

  // Filter messages by active channel
  const filteredMessages = useMemo(() => {
    // Convert transcript messages to ConversationItems with channel_id
    const items: ConversationItem[] = transcript.map((msg) => {
      // Extract channel_id from message metadata if available
      // For now, assume all messages are in 'main' channel
      // In a real implementation, this would come from the message metadata
      return {
        type: 'message' as const,
        role: msg.role,
        content: msg.content,
        created_at: msg.timestamp,
      };
    });

    // If activeChannelId is 'main', show all messages
    if (activeChannelId === 'main') {
      return items;
    }

    // Filter for specific agent channel
    // In a real implementation, messages would have channel_id metadata
    // For now, return all messages (this will be enhanced when backend provides channel_id)
    return items;
  }, [transcript, activeChannelId]);

  // Handle sending a new message
  const handleSend = useCallback(async (content: string) => {
    // Hide suggestions after first message
    setSuggestionsVisible(false);

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
          className="mt-4 px-4 py-2 bg-accent-primary/20 text-accent-primary rounded hover:bg-accent-primary/30 transition-colors"
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
      {/* Agent Tab Bar - only show if agents are present */}
      {agents.length > 0 && (
        <AgentTabBar
          activeChannelId={activeChannelId}
          onSelectChannel={setActiveChannelId}
          agents={agents}
          mainUnreadCount={0} // TODO: Track unread count for main channel
        />
      )}

      {/* Reconnection Banner */}
      {showReconnected && (
        <div className="px-4 py-2 bg-success/10 border-b border-success/20 text-center animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-xs text-success">Reconnected — you're back in the conversation</p>
        </div>
      )}

      {/* Context Banner for Focus Mode */}
      {focusedBlockId && focusedBlock && (
        <div className="flex items-center justify-between px-4 py-3 bg-accent-primary/10 border-b border-accent-primary/20">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent-primary" />
            <span className="text-sm text-text-primary font-medium">
              Focused on step
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
          <button
            onClick={handleClearFocus}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
            aria-label="Clear focus"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto relative">
        <ConversationMessages
          messages={transcript}
          items={filteredMessages}
          onSelectOption={handleSelectOption}
        />
        {isTyping && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[var(--canvas-bg)] to-transparent">
            <TypingIndicator />
          </div>
        )}
      </div>

      {/* Reply Bar - shows when there are pending items */}
      {pendingItems && pendingItems.length > 0 && (
        <div className="flex-shrink-0">
          <ReplyBar
            items={pendingItems}
            onReply={(itemId) => {
              onReplyItem?.(itemId);
            }}
            onDismiss={(itemId) => {
              onDismissItem?.(itemId);
            }}
            onNavigate={(itemId) => {
              // Navigate to the item's context (e.g., specific block or agent tab)
              console.log('[ConversationPane] Navigate to item:', itemId);
            }}
          />
        </div>
      )}

      {/* Quick action suggestions - show early in conversation */}
      {suggestionsVisible && transcript.length < 3 && (
        <QuickActions
          phase={phase}
          hasBlocks={hasBlocks}
          hasSteps={hasSteps}
          onAction={handleSend}
        />
      )}

      <div className="flex-shrink-0">
        <ConversationInput
          onSend={handleSend}
          disabled={sending || session.status === 'abandoned'}
          placeholder={getPlaceholder()}
        />
      </div>
    </div>
  );
}
