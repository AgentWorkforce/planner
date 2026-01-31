import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}

const PRESET_COLORS = [
  { hex: '#00d9ff', name: 'Cyan', cssVar: 'accent-cyan' },
  { hex: '#a855f7', name: 'Purple', cssVar: 'accent-purple' },
  { hex: '#00ffc8', name: 'Green', cssVar: 'accent-green' },
  { hex: '#ff6b35', name: 'Orange', cssVar: 'accent-orange' },
  { hex: '#f472b6', name: 'Pink', cssVar: 'accent-pink' },
  { hex: '#facc15', name: 'Yellow', cssVar: 'accent-yellow' },
] as const;

/**
 * Color picker component for initiatives.
 *
 * Displays 6 preset color swatches in a horizontal row.
 * Supports keyboard navigation (arrow keys + Enter).
 *
 * Usage:
 * ```tsx
 * <ColorPicker
 *   value="#00d9ff"
 *   onChange={(hex) => console.log('Selected:', hex)}
 * />
 * ```
 */
export function ColorPicker({ value, onChange, className = '' }: ColorPickerProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const swatchRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Find the index of the currently selected color
  const selectedIndex = PRESET_COLORS.findIndex(
    (color) => color.hex.toLowerCase() === value.toLowerCase()
  );

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0 && swatchRefs.current[focusedIndex]) {
      swatchRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        setFocusedIndex(index === 0 ? PRESET_COLORS.length - 1 : index - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        setFocusedIndex(index === PRESET_COLORS.length - 1 ? 0 : index + 1);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(PRESET_COLORS.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onChange(PRESET_COLORS[index].hex);
        break;
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`} role="radiogroup" aria-label="Color picker">
      {PRESET_COLORS.map((color, index) => {
        const isSelected = index === selectedIndex;

        return (
          <button
            key={color.hex}
            ref={(el) => (swatchRefs.current[index] = el)}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${color.name} color`}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(color.hex)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`
              w-6 h-6 rounded-full cursor-pointer
              transition-all duration-150
              focus:outline-none
              hover:scale-110 hover:opacity-90
              ${
                isSelected
                  ? 'ring-2 ring-offset-2 ring-offset-bg-card ring-current scale-105'
                  : ''
              }
            `}
            style={{ backgroundColor: color.hex, color: color.hex }}
          >
            <span className="sr-only">{color.name}</span>
          </button>
        );
      })}
    </div>
  );
}
