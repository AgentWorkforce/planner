/**
 * ToggleGroup Usage Example
 *
 * This component demonstrates the ToggleGroup component styled with our design system.
 * Perfect for view mode switching in the pipeline page.
 */

import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

// Example 1: View mode switcher
export function ViewModeSwitcher() {
  const [viewMode, setViewMode] = useState<'board' | 'wave' | 'sequence'>('board');

  return (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={(value) => value && setViewMode(value as typeof viewMode)}
      variant="outline"
    >
      <ToggleGroupItem value="board">Board</ToggleGroupItem>
      <ToggleGroupItem value="wave">Wave</ToggleGroupItem>
      <ToggleGroupItem value="sequence">Sequence</ToggleGroupItem>
    </ToggleGroup>
  );
}

// Example 2: Filter group (multi-select)
export function StatusFilter() {
  const [statuses, setStatuses] = useState<string[]>(['active']);

  return (
    <ToggleGroup
      type="multiple"
      value={statuses}
      onValueChange={setStatuses}
      variant="outline"
      className="border border-border-subtle rounded-lg p-1"
    >
      <ToggleGroupItem value="active">Active</ToggleGroupItem>
      <ToggleGroupItem value="completed">Completed</ToggleGroupItem>
      <ToggleGroupItem value="blocked">Blocked</ToggleGroupItem>
    </ToggleGroup>
  );
}

/**
 * Styling Details:
 *
 * - Border: border-border-subtle (var(--color-border-subtle))
 * - Selected state: bg-bg-tertiary (var(--color-bg-tertiary))
 * - Text colors:
 *   - Unselected: text-text-secondary
 *   - Selected: text-text-primary
 *   - Hover: text-text-primary
 * - Transitions: duration-fast (150ms)
 * - Focus ring: ring-accent
 *
 * The component uses Radix UI primitives for accessibility:
 * - Keyboard navigation (arrow keys)
 * - Focus management
 * - ARIA attributes
 */
