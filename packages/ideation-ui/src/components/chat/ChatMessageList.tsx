import { useRef, useEffect } from 'react';
import { TranscriptMessage } from '@/hooks/useIdeationApi';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { Skeleton } from '@/components/ui';

interface ChatMessageListProps {
  messages: TranscriptMessage[];
  loading?: boolean;
  isTyping?: boolean;
}

export function ChatMessageList({ messages, loading, isTyping }: ChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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
      {messages.map((message, index) => (
        <ChatBubble key={index} message={message} />
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
