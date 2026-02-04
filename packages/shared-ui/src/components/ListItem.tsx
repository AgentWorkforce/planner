import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";
import { ChevronRightIcon } from "../icons";

const listItemVariants = cva(
  "flex items-center gap-3 w-full text-left transition-colors",
  {
    variants: {
      variant: {
        default: "hover:bg-muted/50",
        card: "bg-card border border-border rounded-lg hover:border-border/80",
        ghost: "hover:bg-transparent",
      },
      size: {
        sm: "px-2 py-1.5 text-sm",
        md: "px-3 py-2",
        lg: "px-4 py-3",
      },
      clickable: {
        true: "cursor-pointer",
        false: "",
      },
      selected: {
        true: "bg-muted",
        false: "",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed pointer-events-none",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      clickable: false,
      selected: false,
      disabled: false,
    },
  }
);

export type ListItemAccent = "primary" | "success" | "warning" | "error" | "info" | "muted";

/**
 * Accent colors using semantic CSS variables for theme compatibility.
 * Consuming apps can override via CSS variables with fallbacks to Tailwind colors.
 */
const accentColors: Record<ListItemAccent, string> = {
  primary: "bg-primary",
  success: "bg-[var(--color-success,#22c55e)]",
  warning: "bg-[var(--color-warning,#eab308)]",
  error: "bg-[var(--color-error,#ef4444)]",
  info: "bg-[var(--color-info,#3b82f6)]",
  muted: "bg-muted-foreground",
};

export interface ListItemProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof listItemVariants> {
  /** Left slot content (icon, avatar, indicator) */
  left?: React.ReactNode;
  /** Main title */
  title: React.ReactNode;
  /** Optional description below title */
  description?: React.ReactNode;
  /** Optional metadata line */
  metadata?: React.ReactNode;
  /** Right slot content (badge, chevron, action) */
  right?: React.ReactNode;
  /** Show chevron in right slot */
  showChevron?: boolean;
  /** Left accent bar color */
  accent?: ListItemAccent;
  /** Custom selected class */
  selectedClassName?: string;
  /** Custom hover glow class */
  hoverGlowClassName?: string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Generic list item with 3-zone layout: left, center (title/desc/meta), right.
 */
export const ListItem = forwardRef<HTMLDivElement, ListItemProps>(
  (
    {
      variant,
      size,
      clickable,
      selected,
      disabled,
      left,
      title,
      description,
      metadata,
      right,
      showChevron,
      accent,
      selectedClassName,
      hoverGlowClassName,
      onClick,
      className,
      ...props
    },
    ref
  ) => {
    const isClickable = clickable || !!onClick;

    const handleClick = () => {
      if (!disabled && onClick) {
        onClick();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && isClickable && !disabled) {
        e.preventDefault();
        onClick?.();
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          listItemVariants({ variant, size, clickable: isClickable, selected, disabled }),
          accent && "relative pl-0",
          selected && selectedClassName,
          isClickable && hoverGlowClassName,
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={isClickable && !disabled ? 0 : undefined}
        role={isClickable ? "button" : undefined}
        aria-disabled={disabled || undefined}
        {...props}
      >
        {/* Accent bar */}
        {accent && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1 rounded-l",
              accentColors[accent]
            )}
          />
        )}

        {/* Left slot */}
        {left && (
          <div className={cn("flex-shrink-0", accent && "ml-3")}>{left}</div>
        )}

        {/* Center content */}
        <div className={cn("flex-1 min-w-0", !left && accent && "ml-3")}>
          <div className="font-medium text-foreground truncate">{title}</div>
          {description && (
            <div className="text-sm text-muted-foreground truncate">
              {description}
            </div>
          )}
          {metadata && (
            <div className="text-xs text-muted-foreground mt-0.5">{metadata}</div>
          )}
        </div>

        {/* Right slot */}
        {(right || showChevron) && (
          <div className="flex-shrink-0 flex items-center gap-2">
            {right}
            {showChevron && (
              <ChevronRightIcon size={16} className="text-muted-foreground" />
            )}
          </div>
        )}
      </div>
    );
  }
);

ListItem.displayName = "ListItem";

export interface ListItemGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional group label */
  label?: string;
  /** Show dividers between items */
  dividers?: boolean;
}

/**
 * Container for grouping list items with optional label and dividers.
 */
export function ListItemGroup({
  label,
  dividers = false,
  children,
  className,
  ...props
}: ListItemGroupProps) {
  return (
    <div className={cn("space-y-0", className)} role="group" {...props}>
      {label && (
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </div>
      )}
      <div className={cn(dividers && "divide-y divide-border")}>{children}</div>
    </div>
  );
}

export interface FeedItemProps extends Omit<ListItemProps, "variant" | "showChevron"> {
  /** Timestamp to display */
  timestamp?: string;
  /** Show unread indicator */
  unread?: boolean;
}

/**
 * Specialized list item for activity feeds with timestamp and unread indicator.
 */
export const FeedItem = forwardRef<HTMLDivElement, FeedItemProps>(
  ({ timestamp, unread, right, ...props }, ref) => {
    return (
      <ListItem
        ref={ref}
        variant="card"
        right={
          <div className="flex items-center gap-2">
            {unread && (
              <span className="w-2 h-2 rounded-full bg-primary" />
            )}
            {timestamp && (
              <span className="text-xs text-muted-foreground">{timestamp}</span>
            )}
            {right}
          </div>
        }
        {...props}
      />
    );
  }
);

FeedItem.displayName = "FeedItem";
