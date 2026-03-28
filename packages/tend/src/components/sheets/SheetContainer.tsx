import { useEffect } from 'react';
import { CloseIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface SheetContainerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * SheetContainer - Slide-in panel from right edge
 *
 * Features:
 * - Full-height panel with backdrop overlay
 * - Smooth slide animation (transform translateX)
 * - Backdrop click or close button to dismiss
 * - Responsive width (fixed on desktop, full on mobile)
 *
 * Usage:
 * ```tsx
 * <SheetContainer isOpen={isOpen} onClose={handleClose} title="Step Details">
 *   <StepSheet step={step} />
 * </SheetContainer>
 * ```
 */
export function SheetContainer({ isOpen, onClose, title, children, className }: SheetContainerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-bg-deep/60 backdrop-blur-sm z-40 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 w-full md:w-[600px] lg:w-[700px] bg-bg-card border-l border-border-default shadow-xl z-50 flex flex-col',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'sheet-title' : undefined}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          {title && (
            <h2 id="sheet-title" className="text-lg font-semibold text-text-primary">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
            aria-label="Close"
          >
            <CloseIcon size="md" />
          </button>
        </div>

        {/* Content (scrollable) */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
