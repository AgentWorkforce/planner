import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { useChatSettings } from '@/hooks/useChatSettings';
import { ModelPicker } from './ModelPicker';
import { ThinkingBadge } from './ThinkingBadge';
import { PlanModeToggle } from './PlanModeToggle';

interface TerminalInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  /** When provided, enables chat controls (model picker, plan mode, etc.) */
  sessionId?: string;
  /** Send a directive message to the channel (used for plan mode toggling) */
  sendDirective?: (content: string) => void;
}

export const TerminalInput: React.FC<TerminalInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  initialValue = '',
  className = '',
  sessionId,
  sendDirective,
}) => {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { model, setModel, modelInfo, models, planMode, togglePlanMode } = useChatSettings(sessionId);

  useEffect(() => {
    setValue(initialValue);
    if (initialValue && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [initialValue]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePlanModeToggle = () => {
    const newState = !planMode;
    togglePlanMode();
    if (sendDirective) {
      if (newState) {
        sendDirective('[system:plan_mode:on] Plan Mode activated. For your next responses: think deeply, structure with clear sections, identify unknowns and risks, suggest concrete next steps.');
      } else {
        sendDirective('[system:plan_mode:off] Plan Mode deactivated. Return to normal conversational responses.');
      }
    }
  };

  const hasContent = value.trim().length > 0;

  return (
    <div className={`p-3 flex-shrink-0 ${className}`}>
      <div
        className="rounded-lg"
        style={{ backgroundColor: 'var(--color-bg-input)' }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className="w-full px-3 py-2 bg-transparent text-sm resize-none outline-none border-none text-text-primary placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {sessionId && (
          <div className="flex items-center justify-between px-2 pb-2 pt-0">
            <div className="flex items-center gap-1">
              <ModelPicker value={model} onChange={setModel} models={models} />
              <ThinkingBadge label={modelInfo.thinkingLabel} />
              <PlanModeToggle enabled={planMode} onToggle={handlePlanModeToggle} />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={disabled || !hasContent}
                className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
                  hasContent && !disabled
                    ? 'bg-text-primary text-bg-deep hover:opacity-80'
                    : 'bg-text-muted/20 text-text-muted cursor-default'
                }`}
              >
                <ArrowUp size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
