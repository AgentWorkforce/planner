import React, { useCallback } from "react";
import { cn } from "../utils/cn";
import { SearchIcon, CloseIcon } from "../icons";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Show clear button when there's content */
  showClear?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
}

/**
 * Search input with icon and optional clear button.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  showClear = true,
  className,
  ...props
}: SearchInputProps) {
  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);

  return (
    <div className={cn("relative", className)}>
      <SearchIcon
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        size={16}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full pl-9 pr-9 py-2 text-sm rounded-md",
          "bg-background border border-border",
          "text-foreground placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
          "transition-colors"
        )}
        {...props}
      />
      {showClear && value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear search"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
}
