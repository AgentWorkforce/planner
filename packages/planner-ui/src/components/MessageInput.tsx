/**
 * MessageInput Component
 *
 * Input field for composing and sending messages.
 * Supports Enter to send, Shift+Enter for new line.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { SendIcon } from './icons';

interface MessageInputProps {
  onSend: (content: string, data?: Record<string, unknown>) => void;
  disabled?: boolean;
  placeholder?: string;
  planContext?: {
    planId: string;
    planTitle: string;
    stepId?: string;
    stepTitle?: string;
  };
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  planContext,
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

    // Include plan context in message data if available
    const data = planContext
      ? {
          planId: planContext.planId,
          planTitle: planContext.planTitle,
          stepId: planContext.stepId,
          stepTitle: planContext.stepTitle,
        }
      : undefined;

    onSend(trimmed, data);
    setValue('');
  }, [value, disabled, planContext, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border-subtle p-3 flex-shrink-0">
      {/* Context is passed to agents via message data, no need to display */}
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
            className="w-full px-3 py-2 bg-bg-tertiary border border-border-subtle rounded-lg text-text-primary text-sm placeholder:text-text-muted focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan/50 outline-none resize-none min-h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Message input"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className="flex-shrink-0 p-2 bg-accent-cyan text-bg-deep rounded-lg transition-all duration-150 hover:shadow-glow-cyan disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          aria-label="Send message"
        >
          <SendIcon size="lg" />
        </button>
      </div>

      <div className="mt-1 px-1">
        <span className="text-[10px] text-text-muted">
          Enter to send · Shift+Enter for new line
        </span>
      </div>
    </div>
  );
}
