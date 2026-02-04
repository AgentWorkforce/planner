import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "../utils/cn";
import { SearchIcon, CloseIcon } from "../icons";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  keywords?: string[];
}

export interface CommandSection {
  id: string;
  title: string;
  items: CommandItem[];
}

export interface CommandPaletteProps {
  /** Whether the palette is open */
  isOpen: boolean;
  /** Callback when palette should close */
  onClose: () => void;
  /** Callback when an item is selected */
  onSelect: (itemId: string, sectionId: string) => void;
  /** Sections containing command items */
  sections: CommandSection[];
  /** Placeholder text for search input */
  placeholder?: string;
  /** Empty state message when no results */
  emptyMessage?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * VS Code-style command palette with fuzzy search and keyboard navigation.
 * Extensible via sections prop - consumers provide their own commands.
 */
export function CommandPalette({
  isOpen,
  onClose,
  onSelect,
  sections,
  placeholder = "Type a command or search...",
  emptyMessage = "No results found",
  className,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items based on query
  const filteredSections = useMemo(() => {
    if (!query.trim()) {
      return sections;
    }

    const lowerQuery = query.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const searchText = [
            item.label,
            item.description,
            ...(item.keywords || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return searchText.includes(lowerQuery);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, query]);

  // Flatten items for keyboard navigation
  const flatItems = useMemo(() => {
    return filteredSections.flatMap((section) =>
      section.items.map((item) => ({ ...item, sectionId: section.id }))
    );
  }, [filteredSections]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const highlighted = listRef.current.querySelector('[data-highlighted="true"]');
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < flatItems.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : flatItems.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (flatItems[highlightedIndex] && !flatItems[highlightedIndex].disabled) {
            onSelect(flatItems[highlightedIndex].id, flatItems[highlightedIndex].sectionId);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatItems, highlightedIndex, onSelect, onClose]
  );

  const handleSelect = (item: CommandItem & { sectionId: string }) => {
    if (item.disabled) return;
    onSelect(item.id, item.sectionId);
    onClose();
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  let itemIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "w-full max-w-xl bg-popover border border-border rounded-lg shadow-2xl overflow-hidden",
          "animate-in fade-in-0 zoom-in-95 duration-150",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <SearchIcon size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            aria-label="Search commands"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
              aria-label="Clear search"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto"
          role="listbox"
        >
          {filteredSections.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            filteredSections.map((section) => (
              <div key={section.id}>
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </div>
                {section.items.map((item) => {
                  itemIndex++;
                  const isHighlighted = itemIndex === highlightedIndex;
                  const itemWithSection = { ...item, sectionId: section.id };

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isHighlighted}
                      disabled={item.disabled}
                      data-highlighted={isHighlighted}
                      onClick={() => handleSelect(itemWithSection)}
                      onMouseEnter={() => setHighlightedIndex(itemIndex)}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 text-left",
                        "hover:bg-muted focus:bg-muted focus:outline-none",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        isHighlighted && "bg-muted"
                      )}
                    >
                      {item.icon && (
                        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground">
                          {item.icon}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {item.label}
                        </div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {item.description}
                          </div>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="flex-shrink-0 px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground border-t border-border">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px]">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px]">
              ↵
            </kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px]">
              Esc
            </kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing command palette state with Cmd+K / Ctrl+K shortcut.
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}
