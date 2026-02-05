import { useEffect, useState, useCallback } from "react";
import { cn } from "../utils/cn";
import {
  InfoIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  XCircleIcon,
  MessageIcon,
  CloseIcon,
} from "../icons";

export type ToastType = "info" | "success" | "warning" | "error" | "message";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  maxVisible?: number;
}

const positionClasses = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
};

/**
 * Container component that renders toast notifications.
 */
export function ToastContainer({
  toasts,
  onDismiss,
  position = "top-right",
  maxVisible = 5,
}: ToastContainerProps) {
  const visibleToasts = toasts.slice(0, maxVisible);

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col gap-2 pointer-events-none",
        positionClasses[position]
      )}
    >
      {visibleToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const typeConfig: Record<
  ToastType,
  { icon: typeof InfoIcon; iconBg: string; iconColor: string; progressColor: string }
> = {
  info: {
    icon: InfoIcon,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    progressColor: "bg-blue-500",
  },
  success: {
    icon: CheckCircleIcon,
    iconBg: "bg-green-500/10",
    iconColor: "text-green-500",
    progressColor: "bg-green-500",
  },
  warning: {
    icon: AlertTriangleIcon,
    iconBg: "bg-yellow-500/10",
    iconColor: "text-yellow-500",
    progressColor: "bg-yellow-500",
  },
  error: {
    icon: XCircleIcon,
    iconBg: "bg-red-500/10",
    iconColor: "text-red-500",
    progressColor: "bg-red-500",
  },
  message: {
    icon: MessageIcon,
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
    progressColor: "bg-purple-500",
  },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [toast.id, onDismiss]);

  // Auto-dismiss
  useEffect(() => {
    if (toast.duration === 0) return;

    const duration = toast.duration || 5000;
    const timer = setTimeout(handleDismiss, duration);
    return () => clearTimeout(timer);
  }, [toast.duration, handleDismiss]);

  const config = typeConfig[toast.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 w-[360px] p-4 bg-background border border-border rounded-lg shadow-lg pointer-events-auto relative overflow-hidden",
        "animate-in slide-in-from-right-full duration-200",
        isExiting && "animate-out slide-out-to-right-full duration-200"
      )}
      role="alert"
    >
      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          config.iconBg,
          config.iconColor
        )}
      >
        <Icon size={16} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {toast.message}
          </p>
        )}
        {toast.action && (
          <button
            className="mt-2 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 rounded transition-colors"
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <CloseIcon size={14} />
      </button>

      {/* Progress bar */}
      {toast.duration !== 0 && (
        <div
          className={cn("absolute bottom-0 left-0 h-0.5 opacity-30", config.progressColor)}
          style={{
            animation: `toast-progress ${toast.duration || 5000}ms linear forwards`,
          }}
        />
      )}

      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
