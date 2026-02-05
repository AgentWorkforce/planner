import { useEffect, useRef, useCallback } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";
import { CloseIcon, ChevronLeftIcon } from "../icons";

const panelVariants = cva(
  "fixed top-0 right-0 h-full bg-background border-l border-border shadow-xl flex flex-col z-50",
  {
    variants: {
      size: {
        sm: "w-80",
        md: "w-96",
        lg: "w-[480px]",
        xl: "w-[600px]",
        full: "w-full max-w-2xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface DetailPanelProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof panelVariants> {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Panel title */
  title?: React.ReactNode;
  /** Show back button instead of close */
  showBackButton?: boolean;
  /** Back button handler */
  onBack?: () => void;
  /** Header actions slot */
  headerActions?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
  /** Show backdrop overlay */
  showBackdrop?: boolean;
}

/**
 * Slide-out detail panel with header, scrollable body, and optional footer.
 */
export function DetailPanel({
  isOpen,
  onClose,
  title,
  showBackButton = false,
  onBack,
  headerActions,
  footer,
  closeOnBackdrop = true,
  showBackdrop = true,
  size,
  className,
  children,
  ...props
}: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      panelRef.current?.focus();
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousActiveElement.current?.focus();
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      {showBackdrop && (
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-in fade-in-0 duration-200"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          panelVariants({ size }),
          "animate-in slide-in-from-right duration-300",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : "Detail panel"}
        tabIndex={-1}
        {...props}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border">
          {/* Back/Close button */}
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack || onClose}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              aria-label="Go back"
            >
              <ChevronLeftIcon size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              aria-label="Close panel"
            >
              <CloseIcon size={18} />
            </button>
          )}

          {/* Title */}
          {title && (
            <h2 className="flex-1 font-semibold text-foreground truncate">
              {title}
            </h2>
          )}

          {/* Header actions */}
          {headerActions && (
            <div className="flex items-center gap-2">{headerActions}</div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-muted/30">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Section within a DetailPanel with optional title.
 */
export function DetailPanelSection({
  title,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { title?: string }) {
  return (
    <div className={cn("px-4 py-4", className)} {...props}>
      {title && (
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

/**
 * Divider between DetailPanel sections.
 */
export function DetailPanelDivider({ className }: { className?: string }) {
  return <div className={cn("border-t border-border", className)} />;
}
