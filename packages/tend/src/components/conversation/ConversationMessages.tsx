import { useRef, useEffect } from 'react';
import { TranscriptMessage } from '@/hooks/useIdeationApi';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ContextMarker } from './ContextMarker';
import { Skeleton } from '@/components/ui';

interface ContextMarkerMessage {
  type: 'context_marker';
  marker_type: 'focus_shift' | 'phase_change' | 'agent_switch';
  label: string;
  timestamp: string;
  onClick?: () => void;
}

type MessageItem = TranscriptMessage | ContextMarkerMessage;

interface ConversationMessagesProps {
  messages: MessageItem[];
  loading?: boolean;
  isTyping?: boolean;
  onOptionSelect?: (value: string) => void;
}

function isContextMarker(message: MessageItem): message is ContextMarkerMessage {
  return 'type' in message && message.type === 'context_marker';
}

export function ConversationMessages({ messages, loading, isTyping, onOptionSelect }: ConversationMessagesProps) {
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
      {messages.map((message, index) => {
        if (isContextMarker(message)) {
          return (
            <ContextMarker
              key={`marker-${index}`}
              type={message.marker_type}
              label={message.label}
              timestamp={message.timestamp}
              onClick={message.onClick}
            />
          );
        }
        return <MessageBubble key={index} message={message} onOptionSelect={onOptionSelect} />;
      })}
      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}
