import { useState } from 'react';
import { cn } from '@/lib/utils';

interface MultipleChoiceInputProps {
  options: string[];
  onSelect: (value: string) => void;
  selected?: string;
  disabled?: boolean;
}

/**
 * MultipleChoiceInput - Renders clickable option buttons for AI questions
 *
 * Features:
 * - Shows 2-5 clickable option buttons
 * - Single-select by default
 * - Selected option highlighted with moss green border
 * - "Submit" button to confirm selection
 * - Compact layout that fits within the conversation stream
 *
 * Usage:
 * <MultipleChoiceInput
 *   options={["Option A", "Option B", "Option C"]}
 *   onSelect={(value) => console.log("Selected:", value)}
 * />
 */
export function MultipleChoiceInput({
  options,
  onSelect,
  selected,
  disabled = false,
}: MultipleChoiceInputProps) {
  const [internalSelected, setInternalSelected] = useState<string | undefined>(selected);
  const currentSelected = selected ?? internalSelected;

  const handleOptionClick = (option: string) => {
    if (disabled) return;
    setInternalSelected(option);
  };

  const handleSubmit = () => {
    if (!currentSelected || disabled) return;
    onSelect(currentSelected);
  };

  return (
    <div className="mt-3 space-y-2">
      {/* Options */}
      <div className="flex flex-col gap-2">
        {options.map((option, index) => {
          const isSelected = currentSelected === option;
          return (
            <button
              key={index}
              onClick={() => handleOptionClick(option)}
              disabled={disabled}
              className={cn(
                'px-4 py-2 text-sm text-left rounded-lg border transition-all',
                'hover:bg-[var(--color-bg-hover)] active:bg-[var(--color-bg-active)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-moss)]',
                isSelected
                  ? 'border-[var(--color-moss)] bg-[var(--color-accent-light)] text-[var(--color-text-primary)] font-medium'
                  : 'border-[var(--color-border-default)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]',
                disabled && 'opacity-60 cursor-not-allowed'
              )}
              aria-pressed={isSelected}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={!currentSelected || disabled}
        className={cn(
          'px-4 py-2 text-sm font-medium rounded-lg transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-moss)]',
          currentSelected && !disabled
            ? 'bg-[var(--color-moss)] text-[var(--color-text-inverse)] hover:bg-[var(--color-accent-hover)]'
            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] cursor-not-allowed'
        )}
      >
        Submit
      </button>
    </div>
  );
}
