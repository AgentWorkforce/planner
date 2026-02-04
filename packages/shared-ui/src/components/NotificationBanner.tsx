import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";
import {
  InfoIcon,
  AlertTriangleIcon,
  XCircleIcon,
  CheckCircleIcon,
  CloseIcon,
  ChevronRightIcon,
} from "../icons";

/**
 * Banner variants using semantic CSS variables for theme compatibility.
 * Consuming apps can override via CSS variables:
 * --color-info, --color-warning, --color-error, --color-success (and -light variants)
 */
const bannerVariants = cva(
  "relative rounded-lg border p-4",
  {
    variants: {
      variant: {
        info: "bg-[var(--color-info-light,rgba(59,130,246,0.1))] border-[var(--color-info,#3b82f6)]/20 text-[var(--color-info,#3b82f6)]",
        warning: "bg-[var(--color-warning-light,rgba(234,179,8,0.1))] border-[var(--color-warning,#eab308)]/20 text-[var(--color-warning,#eab308)]",
        error: "bg-[var(--color-error-light,rgba(239,68,68,0.1))] border-[var(--color-error,#ef4444)]/20 text-[var(--color-error,#ef4444)]",
        success: "bg-[var(--color-success-light,rgba(34,197,94,0.1))] border-[var(--color-success,#22c55e)]/20 text-[var(--color-success,#22c55e)]",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

const defaultIcons = {
  info: InfoIcon,
  warning: AlertTriangleIcon,
  error: XCircleIcon,
  success: CheckCircleIcon,
};

export interface NotificationBannerItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

export interface NotificationBannerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof bannerVariants> {
  /** Banner title (required) */
  title: string;
  /** Optional description */
  description?: string;
  /** Custom icon override */
  icon?: React.ReactNode;
  /** Clickable items list */
  items?: NotificationBannerItem[];
  /** Item click handler */
  onItemClick?: (id: string) => void;
  /** Show dismiss button */
  dismissible?: boolean;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Custom actions slot */
  actions?: React.ReactNode;
}

/**
 * Notification banner with variants, clickable items, and dismiss action.
 */
export function NotificationBanner({
  variant = "info",
  title,
  description,
  icon,
  items,
  onItemClick,
  dismissible,
  onDismiss,
  actions,
  className,
  ...props
}: NotificationBannerProps) {
  const IconComponent = defaultIcons[variant || "info"];

  return (
    <div
      className={cn(bannerVariants({ variant }), className)}
      role="alert"
      aria-live="polite"
      {...props}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {icon || <IconComponent size={18} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{title}</h4>
          {description && (
            <p className="mt-1 text-sm opacity-90">{description}</p>
          )}

          {/* Items list */}
          {items && items.length > 0 && (
            <ul className="mt-3 space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onItemClick?.(item.id)}
                    className={cn(
                      "flex items-center gap-2 w-full text-left px-2 py-1.5 -mx-2 rounded",
                      "hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                      "text-sm"
                    )}
                  >
                    {item.icon && (
                      <span className="flex-shrink-0">{item.icon}</span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="font-medium truncate block">
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="text-xs opacity-75 truncate block">
                          {item.sublabel}
                        </span>
                      )}
                    </span>
                    <ChevronRightIcon size={14} className="flex-shrink-0 opacity-50" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Actions */}
          {actions && <div className="mt-3 flex items-center gap-2">{actions}</div>}
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Dismiss notification"
          >
            <CloseIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
