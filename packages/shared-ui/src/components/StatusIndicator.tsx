import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon, InfoIcon } from "../icons";

/**
 * StatusIndicator variants using semantic CSS variables for theme compatibility.
 * Consuming apps can override colors via CSS variables:
 * --color-success, --color-error, --color-warning, --color-info, --color-pending
 */
const statusIndicatorVariants = cva(
  "inline-flex items-center justify-center rounded-full",
  {
    variants: {
      variant: {
        dot: "",
        badge: "px-2 py-0.5 text-xs font-medium",
        icon: "",
      },
      size: {
        sm: "",
        md: "",
        lg: "",
      },
      status: {
        success: "bg-[var(--color-success,#22c55e)] text-[var(--color-success,#22c55e)]",
        error: "bg-[var(--color-error,#ef4444)] text-[var(--color-error,#ef4444)]",
        warning: "bg-[var(--color-warning,#eab308)] text-[var(--color-warning,#eab308)]",
        info: "bg-[var(--color-info,#3b82f6)] text-[var(--color-info,#3b82f6)]",
        pending: "bg-[var(--color-pending,#9ca3af)] text-[var(--color-pending,#9ca3af)]",
        active: "bg-primary text-primary",
      },
      animated: {
        true: "animate-pulse",
        false: "",
      },
    },
    compoundVariants: [
      // Dot sizes
      { variant: "dot", size: "sm", className: "w-1.5 h-1.5" },
      { variant: "dot", size: "md", className: "w-2 h-2" },
      { variant: "dot", size: "lg", className: "w-3 h-3" },
      // Icon sizes
      { variant: "icon", size: "sm", className: "w-4 h-4" },
      { variant: "icon", size: "md", className: "w-5 h-5" },
      { variant: "icon", size: "lg", className: "w-6 h-6" },
      // Badge colors - use semantic variables with light backgrounds
      { variant: "badge", status: "success", className: "bg-[var(--color-success-light,rgba(34,197,94,0.1))] text-[var(--color-success,#22c55e)]" },
      { variant: "badge", status: "error", className: "bg-[var(--color-error-light,rgba(239,68,68,0.1))] text-[var(--color-error,#ef4444)]" },
      { variant: "badge", status: "warning", className: "bg-[var(--color-warning-light,rgba(234,179,8,0.1))] text-[var(--color-warning,#eab308)]" },
      { variant: "badge", status: "info", className: "bg-[var(--color-info-light,rgba(59,130,246,0.1))] text-[var(--color-info,#3b82f6)]" },
      { variant: "badge", status: "pending", className: "bg-[var(--color-pending-light,rgba(156,163,175,0.1))] text-[var(--color-pending,#9ca3af)]" },
      { variant: "badge", status: "active", className: "bg-primary/10 text-primary" },
    ],
    defaultVariants: {
      variant: "dot",
      size: "md",
      status: "pending",
      animated: false,
    },
  }
);

export type StatusType = "success" | "error" | "warning" | "info" | "pending" | "active";

const defaultIcons: Record<StatusType, typeof CheckCircleIcon> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
  pending: InfoIcon,
  active: CheckCircleIcon,
};

export interface StatusIndicatorProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
    VariantProps<typeof statusIndicatorVariants> {
  /** Status type */
  status?: StatusType;
  /** Optional label for badge variant */
  label?: string;
  /** Custom icon for icon variant */
  icon?: React.ReactNode;
  /** Show pulse animation */
  animated?: boolean;
  /** Tooltip text */
  tooltip?: string;
}

/**
 * Generic status indicator supporting dot, badge, and icon variants.
 */
export function StatusIndicator({
  variant = "dot",
  size = "md",
  status = "pending",
  label,
  icon,
  animated = false,
  tooltip,
  className,
  ...props
}: StatusIndicatorProps) {
  const IconComponent = defaultIcons[status];

  const content = () => {
    if (variant === "badge") {
      return label || status;
    }
    if (variant === "icon") {
      return icon || <IconComponent size={size === "sm" ? 14 : size === "md" ? 16 : 20} />;
    }
    return null;
  };

  return (
    <span
      className={cn(
        statusIndicatorVariants({ variant, size, status, animated }),
        className
      )}
      title={tooltip}
      role="status"
      aria-label={tooltip || `Status: ${status}`}
      {...props}
    >
      {content()}
    </span>
  );
}

/**
 * Preset status dot with common configurations.
 */
export function StatusDot({
  status,
  animated,
  className,
  ...props
}: Omit<StatusIndicatorProps, "variant" | "label" | "icon">) {
  return (
    <StatusIndicator
      variant="dot"
      status={status}
      animated={animated}
      className={className}
      {...props}
    />
  );
}
