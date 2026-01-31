import { useState } from 'react';

/**
 * IconPicker Component
 *
 * Allows selection of an emoji/icon for initiatives.
 * Features:
 * - Grid of 16 preset initiative emojis
 * - Custom input for typing any emoji
 * - Accessible keyboard navigation
 * - Visual feedback for selected state
 *
 * @example
 * <IconPicker
 *   value="🚀"
 *   onChange={(emoji) => setIcon(emoji)}
 * />
 */

interface IconPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
}

// Preset emojis for common initiative types
const PRESET_EMOJIS = [
  '🚀', // Launch/Rocket
  '🎯', // Target/Goal
  '🚩', // Flag/Milestone
  '⭐', // Star/Priority
  '⚡', // Lightning/Speed
  '📁', // Folder/Organization
  '💼', // Briefcase/Business
  '📊', // Chart/Analytics
  '🔧', // Tool/Engineering
  '📝', // Document/Planning
  '💡', // Idea/Innovation
  '🎨', // Art/Design
  '📈', // Growth/Progress
  '🏆', // Trophy/Achievement
  '🌟', // Sparkle/Feature
  '📦', // Package/Product
];

export function IconPicker({ value, onChange, className = '' }: IconPickerProps) {
  const [customValue, setCustomValue] = useState('');

  const handlePresetClick = (emoji: string) => {
    onChange(emoji);
    setCustomValue(''); // Clear custom input when preset selected
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setCustomValue(inputValue);

    // Only call onChange if there's actual emoji content (non-whitespace)
    // This provides real-time updates as user types
    if (inputValue.trim()) {
      onChange(inputValue.trim());
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Submit on Enter - already called via handleCustomChange
    if (e.key === 'Enter' && customValue.trim()) {
      onChange(customValue.trim());
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Preset emoji grid */}
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="Select an icon"
      >
        {PRESET_EMOJIS.map((emoji) => {
          const isSelected = value === emoji;

          return (
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handlePresetClick(emoji)}
              className={`
                flex items-center justify-center
                w-8 h-8
                text-lg
                rounded-md
                transition-all duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card
                ${
                  isSelected
                    ? 'bg-accent-cyan/10 border border-accent-cyan ring-1 ring-accent-cyan'
                    : 'border border-transparent hover:bg-bg-tertiary'
                }
              `}
              title={`Select ${emoji}`}
            >
              {emoji}
            </button>
          );
        })}
      </div>

      {/* Custom emoji input */}
      <div className="space-y-1.5">
        <label
          htmlFor="custom-emoji"
          className="block text-xs text-text-secondary font-medium"
        >
          Or type a custom emoji
        </label>
        <input
          id="custom-emoji"
          type="text"
          value={customValue}
          onChange={handleCustomChange}
          onKeyDown={handleCustomKeyDown}
          placeholder="Type any emoji..."
          className="
            w-full
            px-3 py-2
            text-sm
            bg-bg-tertiary
            border border-border-subtle
            rounded-lg
            text-text-primary
            placeholder:text-text-muted
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-accent-cyan focus:border-transparent
            hover:border-border-light
          "
          maxLength={4}
          aria-label="Custom emoji input"
        />
        {customValue && (
          <p className="text-xs text-text-muted">
            Press Enter to confirm, or click a preset above
          </p>
        )}
      </div>
    </div>
  );
}
