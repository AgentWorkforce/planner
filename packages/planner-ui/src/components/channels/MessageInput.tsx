import { useState, useCallback, type KeyboardEvent } from 'react';
import { SendIcon } from '@/components/icons';

interface MessageInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * MessageInput - Text input for sending channel messages
 *
 * Features:
 * - Auto-growing textarea
 * - Enter to send, Shift+Enter for new line
 * - Send button with disabled state
 * - Clears input after sending
 *
 * Usage:
 * ```tsx
 * <MessageInput
 *   onSend={(msg) => sendToChannel(msg)}
 *   placeholder="Type a message..."
 *   disabled={!connected}
 * />
 * ```
 */
export function MessageInput({ onSend, placeholder = 'Type a message...', disabled }: MessageInputProps) {
  const [value, setValue] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }, [value, onSend, disabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex items-end gap-2 p-4 border-t border-border-subtle">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="flex items-center justify-center w-9 h-9 bg-accent-cyan text-bg-deep rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        aria-label="Send message"
      >
        <SendIcon size="sm" />
      </button>
    </div>
  );
}
