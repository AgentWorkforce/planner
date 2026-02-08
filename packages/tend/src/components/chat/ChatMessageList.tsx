import { useRef, useEffect } from 'react';
import { TranscriptMessage } from '@/hooks/useIdeationApi';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { Skeleton } from '@/components/ui';

interface ChatMessageListProps {
  messages: TranscriptMessage[];
  loading?: boolean;
  isTyping?: boolean;
  onSelectOption?: (optionId: string) => void;
}

export function ChatMessageList({ messages, loading, isTyping, onSelectOption }: ChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Find the latest unanswered question with multiple choice options
  let latestUnansweredIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.role === 'assistant' && msg.multiple_choice && !msg.multiple_choice.selected_id) {
      latestUnansweredIndex = i;
      break;
    }
  }

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

  return (
    <div ref={containerRef} className="p-4">
      {messages.map((message, index) => {
        const isLatestUnanswered = index === latestUnansweredIndex;
        return (
          <ChatBubble
            key={index}
            message={message}
            onSelectOption={onSelectOption}
            isLatestUnanswered={isLatestUnanswered}
          />
        );
      })}
      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
