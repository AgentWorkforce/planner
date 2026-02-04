import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon, InfoIcon } from "../icons";

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
        success: "bg-green-500 text-green-500",
        error: "bg-red-500 text-red-500",
        warning: "bg-yellow-500 text-yellow-500",
        info: "bg-blue-500 text-blue-500",
        pending: "bg-gray-400 text-gray-400",
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
      // Badge colors - need different bg for readability
      { variant: "badge", status: "success", className: "bg-green-500/10 text-green-600" },
      { variant: "badge", status: "error", className: "bg-red-500/10 text-red-600" },
      { variant: "badge", status: "warning", className: "bg-yellow-500/10 text-yellow-600" },
      { variant: "badge", status: "info", className: "bg-blue-500/10 text-blue-600" },
      { variant: "badge", status: "pending", className: "bg-gray-500/10 text-gray-600" },
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
