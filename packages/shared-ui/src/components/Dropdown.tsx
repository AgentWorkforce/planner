import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../utils/cn";
import { ChevronDownIcon, CheckIcon } from "../icons";

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

export interface DropdownProps {
  /** Dropdown items */
  items: DropdownItem[];
  /** Currently selected item ID */
  value?: string;
  /** Callback when item is selected */
  onSelect: (id: string) => void;
  /** Trigger element (if not provided, uses default button) */
  trigger?: React.ReactNode;
  /** Placeholder text for default trigger */
  placeholder?: string;
  /** Alignment of dropdown menu */
  align?: "left" | "right";
  /** Width of dropdown menu */
  width?: "auto" | "trigger" | number;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Dropdown menu component with keyboard navigation.
 */
export function Dropdown({
  items,
  value,
  onSelect,
  trigger,
  placeholder = "Select...",
  align = "left",
  width = "trigger",
  disabled = false,
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((item) => item.id === value);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (isOpen && highlightedIndex >= 0) {
            const item = items[highlightedIndex];
            if (!item.disabled) {
              onSelect(item.id);
              setIsOpen(false);
            }
          } else {
            setIsOpen(true);
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            setHighlightedIndex((prev) =>
              prev < items.length - 1 ? prev + 1 : 0
            );
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex((prev) =>
              prev > 0 ? prev - 1 : items.length - 1
            );
          }
          break;
        case "Escape":
          setIsOpen(false);
          break;
      }
    },
    [disabled, isOpen, highlightedIndex, items, onSelect]
  );

  const handleSelect = (item: DropdownItem) => {
    if (item.disabled) return;
    onSelect(item.id);
    setIsOpen(false);
  };

  const menuWidth =
    width === "auto"
      ? "auto"
      : width === "trigger"
        ? triggerRef.current?.offsetWidth
        : width;

  return (
    <div className={cn("relative inline-block", className)}>
      {/* Trigger */}
      {trigger ? (
        <div onClick={() => !disabled && setIsOpen(!isOpen)}>{trigger}</div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md border border-border bg-background",
            "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-w-[120px]"
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={cn(!selectedItem && "text-muted-foreground")}>
            {selectedItem?.label ?? placeholder}
          </span>
          <ChevronDownIcon
            size={14}
            className={cn(
              "text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </button>
      )}

      {/* Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 py-1 bg-popover border border-border rounded-md shadow-md",
            "animate-in fade-in-0 zoom-in-95 duration-100",
            align === "right" ? "right-0" : "left-0"
          )}
          style={{ width: menuWidth }}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === value}
              disabled={item.disabled}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm text-left",
                "hover:bg-muted focus:bg-muted focus:outline-none",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                item.danger && "text-destructive",
                highlightedIndex === index && "bg-muted",
                item.id === value && "font-medium"
              )}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.id === value && (
                <CheckIcon size={14} className="flex-shrink-0 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
