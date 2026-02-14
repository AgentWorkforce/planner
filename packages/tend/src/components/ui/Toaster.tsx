import { useToast, type Toast } from '@/hooks/useToast';
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon, AlertTriangleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    // Wait for exit animation before actually removing
    setTimeout(() => onDismiss(toast.id), 200);
  };

  // Auto-dismiss on unmount cleanup
  useEffect(() => {
    return () => {
      // Cleanup handled by useToast auto-dismiss timer
    };
  }, []);

  const variantStyles = {
    success: 'bg-green-900/90 border-green-700',
    error: 'bg-red-900/90 border-red-700',
    info: 'bg-blue-900/90 border-blue-700',
    warning: 'bg-yellow-900/90 border-yellow-700',
  };

  const iconMap = {
    success: <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />,
    error: <AlertCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0" />,
    info: <InfoIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />,
    warning: <AlertTriangleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />,
  };

  const variant = toast.variant || 'info';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        ${variantStyles[variant]}
        border rounded-lg shadow-lg p-4
        flex items-start gap-3 min-w-[320px] max-w-[420px]
        transition-all duration-200 ease-out
        ${isExiting ? 'opacity-0 translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'}
        animate-in slide-in-from-right
      `}
      style={{
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Icon */}
      {iconMap[variant]}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-white text-sm">
          {toast.title}
        </div>
        {toast.description && (
          <div className="text-gray-300 text-sm mt-1">
            {toast.description}
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
        aria-label="Dismiss notification"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Toaster component - renders toast notifications
 *
 * Add this component at the root level of your app (in App.tsx).
 *
 * Usage:
 * ```tsx
 * <Toaster />
 * ```
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
