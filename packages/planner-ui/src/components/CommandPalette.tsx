import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFuzzySearch } from '@/hooks/useFuzzySearch';
import { PlanResultItem } from './PlanResultItem';
import type { PlanSummary } from '@/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  plans: PlanSummary[];
  recentPlanIds: string[];
}

/**
 * Command palette modal for quick plan navigation.
 *
 * Features:
 * - Opens with Cmd+K / Ctrl+K (managed by useCommandPalette)
 * - Fuzzy search as you type
 * - Recent plans shown when query is empty
 * - Keyboard navigation (Up/Down arrows, Enter to select, Escape to close)
 * - Selected item scrolls into view
 * - Click outside or Escape to close
 */
export function CommandPalette({ isOpen, onClose, plans, recentPlanIds }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Fuzzy search results
  const searchResults = useFuzzySearch(plans, query);

  // Recent plans (filter to plans that exist)
  const recentPlans = useMemo(() => {
    const planMap = new Map(plans.map((p) => [p.plan_id, p]));
    return recentPlanIds.map((id) => planMap.get(id)).filter((p): p is PlanSummary => p !== undefined);
  }, [plans, recentPlanIds]);

  // Display items: search results if query, otherwise recent plans
  const displayItems = useMemo(() => {
    if (query.trim()) {
      return searchResults.map((r) => r.plan);
    }
    return recentPlans;
  }, [query, searchResults, recentPlans]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after a tick to ensure modal is rendered
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Reset selection when display items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [displayItems]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && listRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, displayItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (displayItems[selectedIndex]) {
            navigate(`/plans/${displayItems[selectedIndex].plan_id}`);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [displayItems, selectedIndex, navigate, onClose]
  );

  // Handle item click
  const handleItemClick = useCallback(
    (planId: string) => {
      navigate(`/plans/${planId}`);
      onClose();
    },
    [navigate, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) {
    return null;
  }

  const showEmptyState = displayItems.length === 0;
  const emptyStateMessage = query.trim()
    ? 'No plans found'
    : recentPlanIds.length === 0
      ? 'No recent plans'
      : 'No plans match your search';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-lg bg-bg-primary border border-border rounded-xl shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="px-4 py-3 border-b border-border-subtle">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plans..."
            className="w-full bg-transparent text-text-primary placeholder:text-text-muted outline-none text-base"
          />
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2 px-2">
          {showEmptyState ? (
            <div className="px-3 py-6 text-center text-text-muted text-sm">{emptyStateMessage}</div>
          ) : (
            <>
              {!query.trim() && displayItems.length > 0 && (
                <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wide">
                  Recent
                </div>
              )}
              {displayItems.map((plan, index) => (
                <PlanResultItem
                  key={plan.plan_id}
                  ref={index === selectedIndex ? selectedItemRef : undefined}
                  plan={plan}
                  isSelected={index === selectedIndex}
                  onClick={() => handleItemClick(plan.plan_id)}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-border-subtle bg-bg-secondary">
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">↵</kbd> open
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary rounded text-text-secondary">esc</kbd> close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
