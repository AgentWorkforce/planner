/**
 * MessageInput Component
 *
 * Input field for composing and sending messages.
 * Supports Enter to send, Shift+Enter for new line.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '../../utils/cn';
import type { MessageInputProps } from '../../types/messaging';

/**
 * Send icon
 */
function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  className,
}: MessageInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setValue('');
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={cn(
        'border-t border-[var(--color-border-subtle,rgba(255,255,255,0.06))] p-3 flex-shrink-0',
        className
      )}
    >
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'w-full px-3 py-2 rounded-lg text-sm resize-none min-h-[38px] outline-none',
              'bg-[var(--color-bg-tertiary,#181824)]',
              'border border-[var(--color-border-subtle,rgba(255,255,255,0.06))]',
              'text-[var(--color-text-primary,#f0f0f5)]',
              'placeholder:text-[var(--color-text-muted,#606070)]',
              'focus:border-[var(--color-accent-cyan,#00d9ff)]',
              'focus:ring-1 focus:ring-[var(--color-accent-cyan,#00d9ff)]/50',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            aria-label="Message input"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className={cn(
            'flex-shrink-0 p-2 rounded-lg transition-all duration-150',
            'bg-[var(--color-accent-cyan,#00d9ff)]',
            'text-[var(--color-bg-deep,#0a0a0f)]',
            'hover:shadow-[var(--shadow-glow-cyan,0_0_20px_rgba(0,217,255,0.3))]',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
          )}
          aria-label="Send message"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-1 px-1">
        <span className="text-[10px] text-[var(--color-text-muted,#606070)]">
          Enter to send · Shift+Enter for new line
        </span>
      </div>
    </div>
  );
}

export default MessageInput;
