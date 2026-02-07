import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { SendIcon } from '@/components/icons';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea (min 3 lines, max 6 lines)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const lineHeight = 20; // ~20px per line at text-sm
      const minHeight = 3 * lineHeight;
      const maxHeight = 6 * lineHeight;
      textarea.style.height = `${Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight))}px`;
    }
  }, [value]);

  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4">
      <div
        className={cn(
          'relative rounded-xl bg-bg-secondary border border-border-subtle shadow-md',
          'transition-all',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={cn(
            'w-full resize-none bg-transparent px-4 py-3 pr-14',
            'text-sm text-text-primary placeholder:text-text-muted',
            'focus:outline-none focus-visible:outline-none',
            'disabled:cursor-not-allowed'
          )}
        />
        <Button
          variant="primary"
          size="icon"
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          title="Send message"
          className="absolute bottom-2 right-2"
        >
          <SendIcon size="md" />
        </Button>
      </div>
      <p className="text-xs text-text-muted mt-1">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
