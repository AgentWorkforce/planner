import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Sheet width presets
 */
type SheetWidth = 'sm' | 'md' | 'lg';

const widthClasses: Record<SheetWidth, string> = {
  sm: 'w-80', // 320px
  md: 'w-[480px]',
  lg: 'w-[640px]',
};

/**
 * Props for SheetContainer component
 */
export interface SheetContainerProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Callback when sheet should close */
  onClose: () => void;
  /** Sheet title */
  title: string;
  /** Width preset */
  width?: SheetWidth;
  /** Sheet content */
  children: React.ReactNode;
  /** Optional footer content (e.g., chat input) */
  footer?: React.ReactNode;
  /** Optional CSS class */
  className?: string;
}

/**
 * SheetContainer
 *
 * Slide-in panel from the right side using Radix UI Dialog.
 * Features:
 * - Animated slide-in transition (translateX)
 * - Semi-transparent backdrop
 * - Close on backdrop click and Escape key (handled by Radix)
 * - Configurable width presets (sm/md/lg)
 * - Earth-tone styling
 *
 * @example
 * ```tsx
 * <SheetContainer
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Step Details"
 *   width="md"
 * >
 *   <div>Content here</div>
 * </SheetContainer>
 * ```
 */
export function SheetContainer({
  isOpen,
  onClose,
  title,
  width = 'md',
  children,
  footer,
  className,
}: SheetContainerProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/40',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />

        {/* Sheet Content */}
        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 z-50 h-full',
            'flex flex-col',
            'bg-bg-elevated border-l border-border-subtle',
            'shadow-2xl',
            'transition-transform duration-300 ease-in-out',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            widthClasses[width],
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className={cn(
                  'rounded-sm p-1.5',
                  'text-text-secondary hover:text-text-primary',
                  'hover:bg-bg-hover',
                  'transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-accent-cyan'
                )}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="border-t border-border-subtle px-6 py-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
