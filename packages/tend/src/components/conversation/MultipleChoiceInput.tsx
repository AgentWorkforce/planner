import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface MultipleChoiceOption {
  id: string;
  label: string;
  description?: string;
}

export interface MultipleChoiceInputProps {
  options: MultipleChoiceOption[];
  onSelect: (optionId: string) => void;
  onFreeform?: (text: string) => void;
  disabled?: boolean;
  selectedId?: string;
}

/**
 * MultipleChoiceInput - Renders clickable option buttons for AI-offered choices
 *
 * Appears inline within the conversation flow when the AI presents multiple options.
 * Users can select one option from the list or type their own response.
 */
export function MultipleChoiceInput({
  options,
  onSelect,
  onFreeform,
  disabled = false,
  selectedId,
}: MultipleChoiceInputProps) {
  const [freeformText, setFreeformText] = useState('');

  const handleFreeformSubmit = () => {
    if (freeformText.trim() && onFreeform) {
      onFreeform(freeformText.trim());
      setFreeformText('');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => {
        const isSelected = selectedId === option.id;

        return (
          <button
            key={option.id}
            onClick={() => !disabled && onSelect(option.id)}
            disabled={disabled}
            className={cn(
              'flex flex-col items-start px-3 py-2 rounded-lg border transition-all duration-150',
              'text-left',
              isSelected
                ? 'bg-accent-primary/10 border-accent-primary'
                : 'bg-bg-card border-border-subtle hover:bg-bg-hover hover:border-accent-primary',
              disabled && 'opacity-50 pointer-events-none'
            )}
          >
            <div className="flex items-center gap-2 w-full">
              {isSelected && (
                <span className="text-accent-primary font-semibold text-sm">✓</span>
              )}
              <span className="text-text-primary font-medium text-sm flex-1">
                {option.label}
              </span>
            </div>

            {option.description && (
              <p className="text-text-muted text-xs mt-1 ml-0">
                {option.description}
              </p>
            )}
          </button>
        );
      })}

      {onFreeform && !disabled && !selectedId && (
        <input
          type="text"
          value={freeformText}
          onChange={(e) => setFreeformText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleFreeformSubmit();
            }
          }}
          placeholder="or type your own..."
          className={cn(
            'px-3 py-2 rounded-lg border text-sm transition-all duration-150',
            'bg-bg-card border-border-subtle text-text-primary placeholder:text-text-muted',
            'focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary'
          )}
        />
      )}
    </div>
  );
}
