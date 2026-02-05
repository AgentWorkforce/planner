import { cn } from '@/lib/utils';
import type { Toast } from '@/hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

/**
 * Simple toast container that displays toasts at the bottom-right of the screen.
 * No animations, portals, or complex state management - just straightforward rendering.
 */
export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'px-4 py-3 rounded-lg shadow-lg border pointer-events-auto min-w-[300px] max-w-[500px]',
            'text-sm font-medium',
            toast.variant === 'error' && 'bg-red-950 border-red-800 text-red-200',
            toast.variant === 'success' && 'bg-green-950 border-green-800 text-green-200',
            toast.variant === 'warning' && 'bg-yellow-950 border-yellow-800 text-yellow-200',
            toast.variant === 'info' && 'bg-bg-secondary border-border-default text-text-primary'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => onRemove(toast.id)}
              className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
