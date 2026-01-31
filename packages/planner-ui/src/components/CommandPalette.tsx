import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFuzzySearch } from '@/hooks/useFuzzySearch';
import { PlanResultItem } from './PlanResultItem';
import { SearchIcon } from '@/components/icons/SearchIcon';
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-bg-deep/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-xl mx-4 bg-bg-card border border-border-subtle rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-200"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border-subtle">
          <SearchIcon className="text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plans..."
            className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-base"
          />
          <kbd className="hidden sm:inline-flex px-2 py-1 text-xs font-medium text-text-muted bg-bg-tertiary border border-border-subtle rounded-md">
            esc
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2 px-2">
          {showEmptyState ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 mb-3 rounded-full bg-bg-tertiary flex items-center justify-center">
                <SearchIcon className="text-text-muted" />
              </div>
              <p className="text-text-muted text-sm">{emptyStateMessage}</p>
              {!query.trim() && (
                <p className="text-text-dim text-xs mt-1">Start typing to search all plans</p>
              )}
            </div>
          ) : (
            <>
              {!query.trim() && displayItems.length > 0 && (
                <div className="px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Recent Plans
                </div>
              )}
              {query.trim() && (
                <div className="px-3 py-2 text-xs font-medium text-text-muted uppercase tracking-wider">
                  {displayItems.length} {displayItems.length === 1 ? 'result' : 'results'}
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
        <div className="px-4 py-3 border-t border-border-subtle bg-bg-secondary/50">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded font-medium text-text-secondary">↑</kbd>
                <kbd className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded font-medium text-text-secondary">↓</kbd>
                <span className="ml-1">navigate</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded font-medium text-text-secondary">↵</kbd>
                <span className="ml-1">open</span>
              </span>
            </div>
            <span className="text-text-dim">
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded font-medium text-text-secondary">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded font-medium text-text-secondary ml-0.5">K</kbd>
              <span className="ml-1.5">to toggle</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
