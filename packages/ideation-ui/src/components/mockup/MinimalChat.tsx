import type { Message } from '@/lib/mockup/block-utils';
import { ChatMessage } from './ChatMessage';
import { FloatingInput } from './FloatingInput';

interface MinimalChatProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
}

export function MinimalChat({ messages, onSendMessage }: MinimalChatProps) {
  return (
    <div className="flex-1 flex flex-col relative rounded-[32px] bg-[var(--mockup-bg)]/70">
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-5">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>

      <FloatingInput onSend={onSendMessage} />
    </div>
  );
}
