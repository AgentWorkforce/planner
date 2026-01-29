import { useState, useEffect, type ReactNode } from 'react';
import { ChevronIcon } from '@/components/icons';

type AccentColor = 'warning' | 'error' | 'cyan' | 'green' | 'muted';

interface CollapsibleSectionProps {
  sectionId: string;
  title: string;
  count?: number;
  accentColor?: AccentColor;
  defaultCollapsed?: boolean;
  hideWhenEmpty?: boolean;
  children: ReactNode;
  emptyState?: ReactNode;
}

/**
 * Get localStorage key for a section's collapsed state.
 */
function getStorageKey(sectionId: string): string {
  return `section-collapsed-${sectionId}`;
}

/**
 * Get the top border color class based on accent color.
 */
function getTopBorderClass(accentColor: AccentColor): string {
  switch (accentColor) {
    case 'warning':
      return 'bg-warning';
    case 'error':
      return 'bg-error';
    case 'cyan':
      return 'bg-accent-cyan';
    case 'green':
      return 'bg-success';
    case 'muted':
      return 'bg-border-default';
    default:
      return 'bg-border-default';
  }
}

/**
 * Get the badge color class for the count badge.
 */
function getBadgeClass(accentColor: AccentColor): string {
  switch (accentColor) {
    case 'warning':
      return 'bg-warning/20 text-warning';
    case 'error':
      return 'bg-error/20 text-error';
    case 'cyan':
      return 'bg-accent-cyan/20 text-accent-cyan';
    case 'green':
      return 'bg-success/20 text-success';
    case 'muted':
      return 'bg-bg-tertiary text-text-muted';
    default:
      return 'bg-bg-tertiary text-text-secondary';
  }
}

/**
 * Collapsible section with header, count badge, and persistent collapse state.
 *
 * Features:
 * - Click header to toggle collapsed state
 * - Collapsed state persists in localStorage
 * - ChevronIcon rotates on collapse
 * - Animated open/close with max-height transition
 * - Top accent border with configurable color
 */
export function CollapsibleSection({
  sectionId,
  title,
  count,
  accentColor,
  defaultCollapsed = false,
  hideWhenEmpty = false,
  children,
  emptyState,
}: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(getStorageKey(sectionId));
    if (stored !== null) {
      return stored === 'true';
    }
    return defaultCollapsed;
  });

  // Check if section has content
  const hasContent = children !== null && children !== undefined;
  const isEmpty = !hasContent || (Array.isArray(children) && children.length === 0);

  // Hide entire section if empty and hideWhenEmpty is true
  if (hideWhenEmpty && isEmpty) {
    return null;
  }

  // Persist collapse state to localStorage
  useEffect(() => {
    localStorage.setItem(getStorageKey(sectionId), String(isCollapsed));
  }, [sectionId, isCollapsed]);

  const handleToggle = () => {
    setIsCollapsed((prev) => !prev);
  };

  const showCount = count !== undefined && count > 0;

  return (
    <div className="mb-6">
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="group relative w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-bg-hover/30 transition-all duration-150"
      >
        {/* Top accent border */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${
            accentColor ? getTopBorderClass(accentColor) : 'bg-border-default'
          }`}
        />
        <div className="flex items-center gap-3">
          <ChevronIcon
            size="sm"
            direction="down"
            className={`text-text-muted group-hover:text-text-secondary transition-all duration-200 ${
              isCollapsed ? '-rotate-90' : ''
            }`}
          />
          <h2 className="font-display text-lg font-medium text-text-primary">{title}</h2>
          {showCount && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                accentColor ? getBadgeClass(accentColor) : 'bg-bg-tertiary text-text-secondary'
              }`}
            >
              {count}
            </span>
          )}
        </div>
        <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">
          {isCollapsed ? 'Show' : 'Hide'}
        </span>
      </button>

      {/* Content */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
        }`}
      >
        <div className="pt-4 pl-2">
          {isEmpty && emptyState ? emptyState : children}
        </div>
      </div>
    </div>
  );
}
