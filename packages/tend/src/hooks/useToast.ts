import { useState, useCallback, useEffect } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

let toastCounter = 0;

// Singleton state shared across all hook instances
const listeners = new Set<(toasts: Toast[]) => void>();
let toastsState: Toast[] = [];

function updateToasts(newToasts: Toast[]) {
  toastsState = newToasts;
  listeners.forEach((listener) => listener(newToasts));
}

function addToast(options: ToastOptions): string {
  const id = `toast-${++toastCounter}`;
  const toast: Toast = {
    id,
    title: options.title,
    description: options.description,
    variant: options.variant || 'info',
    duration: options.duration ?? 3000,
  };

  updateToasts([...toastsState, toast]);

  // Auto-dismiss after duration
  const duration = toast.duration ?? 0;
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

function dismissToast(id: string) {
  updateToasts(toastsState.filter((t) => t.id !== id));
}

// For testing: clear all toasts
export function clearAllToasts() {
  updateToasts([]);
}

/**
 * Hook for managing toast notifications
 *
 * Usage:
 * ```tsx
 * const { toast } = useToast();
 *
 * toast({
 *   title: "Success",
 *   description: "Your changes have been saved",
 *   variant: "success"
 * });
 * ```
 */
export function useToast(): ToastContextValue {
  const [toasts, setToasts] = useState<Toast[]>(toastsState);

  useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    return addToast(options);
  }, []);

  const dismiss = useCallback((id: string) => {
    dismissToast(id);
  }, []);

  return { toasts, toast, dismiss };
}
