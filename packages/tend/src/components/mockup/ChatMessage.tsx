import { formatTimestamp, type Message } from '@/lib/mockup/block-utils';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.sender === 'agent') {
    return (
      <div className="space-y-1">
        <p className="text-[#3d3d3d] text-sm leading-relaxed max-w-[85%]">{message.text}</p>
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{formatTimestamp(message.timestamp)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm max-w-[75%] text-[var(--color-text-primary)] text-sm leading-relaxed border border-black/5">
        {message.text}
      </div>
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mt-1">{formatTimestamp(message.timestamp)}</span>
    </div>
  );
}
