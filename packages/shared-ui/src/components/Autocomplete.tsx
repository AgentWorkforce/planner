import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../utils/cn";
import { SearchIcon, CloseIcon } from "../icons";
import { LoadingSpinner } from "./LoadingSpinner";

export interface AutocompleteProps<T> {
  /** Available items to filter */
  items?: T[];
  /** Async search function (overrides items filtering) */
  onSearch?: (query: string) => Promise<T[]>;
  /** Render function for each item */
  renderItem: (item: T, highlighted: boolean) => React.ReactNode;
  /** Get unique key for item */
  getItemKey: (item: T) => string;
  /** Get searchable text from item (for local filtering) */
  getItemText?: (item: T) => string;
  /** Called when item is selected */
  onSelect: (item: T) => void;
  /** Current value (controlled) */
  value?: string;
  /** Value change handler (controlled) */
  onValueChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay for search (ms) */
  debounceMs?: number;
  /** Minimum chars before searching */
  minChars?: number;
  /** Empty state message */
  emptyMessage?: string;
  /** Show search icon */
  showSearchIcon?: boolean;
  /** Show clear button */
  showClearButton?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Input CSS classes */
  inputClassName?: string;
  /** Dropdown CSS classes */
  dropdownClassName?: string;
}

/**
 * Generic autocomplete component with keyboard navigation and async support.
 */
export function Autocomplete<T>({
  items = [],
  onSearch,
  renderItem,
  getItemKey,
  getItemText,
  onSelect,
  value: controlledValue,
  onValueChange,
  placeholder = "Search...",
  debounceMs = 300,
  minChars = 1,
  emptyMessage = "No results found",
  showSearchIcon = true,
  showClearButton = true,
  disabled = false,
  className,
  inputClassName,
  dropdownClassName,
}: AutocompleteProps<T>) {
  const [internalValue, setInternalValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [filteredItems, setFilteredItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const value = controlledValue ?? internalValue;
  const setValue = (v: string) => {
    setInternalValue(v);
    onValueChange?.(v);
  };

  // Filter/search items when value changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length < minChars) {
      setFilteredItems([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (onSearch) {
        setIsLoading(true);
        try {
          const results = await onSearch(value);
          setFilteredItems(results);
          setIsOpen(results.length > 0 || value.length >= minChars);
        } finally {
          setIsLoading(false);
        }
      } else if (getItemText) {
        const lowerValue = value.toLowerCase();
        const filtered = items.filter((item) =>
          getItemText(item).toLowerCase().includes(lowerValue)
        );
        setFilteredItems(filtered);
        setIsOpen(true);
      } else {
        setFilteredItems(items);
        setIsOpen(true);
      }
      setHighlightedIndex(-1);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, items, onSearch, getItemText, minChars, debounceMs]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlighted = listRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      );
      highlighted?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" && value.length >= minChars) {
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredItems.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredItems[highlightedIndex]) {
            handleSelect(filteredItems[highlightedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, highlightedIndex, filteredItems, value, minChars]
  );

  const handleSelect = (item: T) => {
    onSelect(item);
    setIsOpen(false);
    setValue("");
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setValue("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Input */}
      <div className="relative">
        {showSearchIcon && (
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= minChars && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showSearchIcon && "pl-9",
            showClearButton && value && "pr-9",
            inputClassName
          )}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        {showClearButton && value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <CloseIcon size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className={cn(
            "absolute z-50 mt-1 w-full max-h-60 overflow-auto",
            "rounded-md border border-border bg-popover shadow-md",
            "animate-in fade-in-0 zoom-in-95 duration-100",
            dropdownClassName
          )}
          role="listbox"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <div
                key={getItemKey(item)}
                data-index={index}
                role="option"
                aria-selected={index === highlightedIndex}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  "cursor-pointer px-3 py-2",
                  "hover:bg-muted",
                  index === highlightedIndex && "bg-muted"
                )}
              >
                {renderItem(item, index === highlightedIndex)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
