import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { CommandIcon } from '@/components/icons/CommandIcon';
import { SettingsIcon } from '@/components/icons/SettingsIcon';
import { PlusIcon } from '@/components/icons/PlusIcon';
import { GridIcon } from '@/components/icons/GridIcon';
import { MessageIcon } from '@/components/icons/MessageIcon';
import { CommandAction } from '@/hooks/useCommandPalette';

interface CommandPaletteProps {
  isOpen: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  selectedIndex: number;
  groupedActions: Record<string, CommandAction[]>;
  onClose: () => void;
  onExecuteAction: (action: CommandAction) => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
  onExecuteSelected: () => void;
}

// Icon mapping for command types
const iconMap: Record<string, React.ComponentType<{ size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }>> = {
  home: GridIcon,
  dashboard: GridIcon,
  plus: PlusIcon,
  settings: SettingsIcon,
  session: MessageIcon,
};

function CommandItem({
  action,
  isSelected,
  onClick,
}: {
  action: CommandAction;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = action.icon ? iconMap[action.icon] : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 md:px-4 py-3 text-left transition-colors',
        'rounded-md min-h-[44px]',
        isSelected
          ? 'bg-accent-light text-text-primary'
          : 'text-text-secondary hover:bg-bg-hover'
      )}
      role="option"
      aria-selected={isSelected}
    >
      {Icon && (
        <div className={cn('flex-shrink-0', isSelected ? 'text-accent-cyan' : 'text-text-muted')}>
          <Icon size="md" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-medium truncate', isSelected ? 'text-text-primary' : 'text-text-primary')}>
          {action.label}
        </div>
        {action.description && (
          <div className="text-xs text-text-muted truncate mt-0.5">
            {action.description}
          </div>
        )}
      </div>
    </button>
  );
}

export function CommandPalette({
  isOpen,
  query,
  onQueryChange,
  selectedIndex,
  groupedActions,
  onClose,
  onExecuteAction,
  onSelectNext,
  onSelectPrevious,
  onExecuteSelected,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          event.preventDefault();
          onSelectNext();
          break;
        case 'ArrowUp':
          event.preventDefault();
          onSelectPrevious();
          break;
        case 'Enter':
          event.preventDefault();
          onExecuteSelected();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSelectNext, onSelectPrevious, onExecuteSelected]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Delay to prevent immediate close from the same click that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Flatten grouped actions for index calculation
  const flatActions: CommandAction[] = [];
  Object.entries(groupedActions).forEach(([, actions]) => {
    flatActions.push(...actions);
  });

  const isEmpty = flatActions.length === 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-[100] animate-fade-in" />

      {/* Command Palette */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center md:pt-[20vh] px-2 md:px-4">
        <div
          ref={containerRef}
          className="w-full max-w-2xl bg-bg-elevated border border-border-subtle rounded-lg shadow-modal animate-slide-down mt-2 md:mt-0"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          {/* Search Input */}
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 border-b border-border-subtle">
            <SearchIcon size="md" className="text-text-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search commands..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder-text-dim min-h-[44px]"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-list"
              aria-autocomplete="list"
            />
            <div className="hidden md:flex items-center gap-1 text-xs text-text-dim">
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded text-[10px] font-mono">
                esc
              </kbd>
            </div>
          </div>

          {/* Results */}
          <div
            id="command-list"
            role="listbox"
            className="max-h-[60vh] overflow-y-auto p-2"
          >
            {isEmpty ? (
              <div className="px-4 py-8 text-center text-text-muted text-sm">
                No results found for "{query}"
              </div>
            ) : (
              <>
                {Object.entries(groupedActions).map(([group, actions], groupIndex) => {
                  // Calculate the starting index for this group
                  const startIndex = Object.entries(groupedActions)
                    .slice(0, groupIndex)
                    .reduce((acc, [, acts]) => acc + acts.length, 0);

                  return (
                    <div key={group} className="mb-4 last:mb-0">
                      {/* Group Header */}
                      <div className="px-2 py-1.5 text-xs font-semibold text-text-dim uppercase tracking-wide">
                        {group}
                      </div>

                      {/* Group Items */}
                      <div className="space-y-1">
                        {actions.map((action, actionIndex) => {
                          const absoluteIndex = startIndex + actionIndex;
                          return (
                            <CommandItem
                              key={action.id}
                              action={action}
                              isSelected={absoluteIndex === selectedIndex}
                              onClick={() => onExecuteAction(action)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer - Hidden on mobile for cleaner UI */}
          <div className="hidden md:flex items-center justify-between px-4 py-2 border-t border-border-subtle bg-bg-secondary">
            <div className="flex items-center gap-4 text-xs text-text-dim">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded text-[10px] font-mono">
                  ↑↓
                </kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded text-[10px] font-mono">
                  ↵
                </kbd>
                <span>Select</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-text-dim">
              <CommandIcon size="sm" className="text-text-dim" />
              <span>+</span>
              <kbd className="px-1.5 py-0.5 bg-bg-tertiary border border-border-subtle rounded text-[10px] font-mono">
                K
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
