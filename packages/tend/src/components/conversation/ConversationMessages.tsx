import { useRef, useEffect } from 'react';
import { TranscriptMessage } from '@/hooks/useIdeationApi';
import { ChatBubble } from '../chat/ChatBubble';
import { TypingIndicator } from '../chat/TypingIndicator';
import { Skeleton } from '@/components/ui';
import { SystemEvent, type SystemEventMetadata, type SystemEventType } from './SystemEvent';
import { ContextMarker } from './ContextMarker';

export type ConversationItem =
  | { type: 'message'; role: 'user' | 'assistant'; content: string; created_at: string; attentionLevel?: 0 | 1 | 2 | 3 }
  | { type: 'system_event'; eventType: SystemEventType; content: string; metadata?: SystemEventMetadata[]; created_at: string }
  | { type: 'context_marker'; label?: string; fromContext?: string; toContext?: string; created_at: string };

interface ConversationMessagesProps {
  messages?: TranscriptMessage[];
  items?: ConversationItem[];
  loading?: boolean;
  isTyping?: boolean;
  onSelectOption?: (optionId: string) => void;
}

export function ConversationMessages({ messages, items, loading, isTyping, onSelectOption }: ConversationMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, items, isTyping]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-16 w-3/4 rounded-lg" />
          </div>
        </div>
        <div className="flex gap-2 mb-4 flex-row-reverse">
          <div className="flex-1 flex justify-end">
            <Skeleton className="h-12 w-1/2 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Backward compatibility: convert old messages format to items
  const conversationItems: ConversationItem[] = items ?? (messages ?? []).map(msg => {
    // Extract attention level from message metadata or raw message
    const rawMsg = msg as unknown as Record<string, unknown>;
    const attentionLevel = rawMsg.attention_level as number | undefined;

    return {
      type: 'message' as const,
      role: msg.role,
      content: msg.content,
      created_at: msg.timestamp,
      attentionLevel: attentionLevel !== undefined && attentionLevel >= 0 && attentionLevel <= 3
        ? (attentionLevel as 0 | 1 | 2 | 3)
        : undefined,
    };
  });

  // Find the latest unanswered question with multiple choice options
  // Only consider assistant messages with multiple_choice that don't have selected_id
  let latestUnansweredIndex = -1;
  const rawMessages = messages ?? [];
  for (let i = rawMessages.length - 1; i >= 0; i--) {
    const msg = rawMessages[i];
    if (msg && msg.role === 'assistant' && msg.multiple_choice && !msg.multiple_choice.selected_id) {
      latestUnansweredIndex = i;
      break;
    }
  }

  return (
    <div ref={containerRef} className="p-4">
      {conversationItems.map((item, index) => {
        if (item.type === 'message') {
          // Find corresponding raw message to preserve multiple_choice data
          const rawMessage = rawMessages[index];

          // Convert back to TranscriptMessage format for ChatBubble
          const transcriptMsg: TranscriptMessage = {
            role: item.role,
            content: item.content,
            timestamp: item.created_at,
            multiple_choice: rawMessage?.multiple_choice,
          };

          const isLatestUnanswered = index === latestUnansweredIndex;

          return (
            <ChatBubble
              key={index}
              message={transcriptMsg}
              onSelectOption={onSelectOption}
              isLatestUnanswered={isLatestUnanswered}
              attentionLevel={item.attentionLevel}
            />
          );
        } else if (item.type === 'system_event') {
          return (
            <SystemEvent
              key={index}
              type={item.eventType}
              content={item.content}
              metadata={item.metadata}
              timestamp={item.created_at}
            />
          );
        } else if (item.type === 'context_marker') {
          return (
            <ContextMarker
              key={index}
              label={item.label}
              fromContext={item.fromContext}
              toContext={item.toContext}
              timestamp={item.created_at}
            />
          );
        }
        return null;
      })}
      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
