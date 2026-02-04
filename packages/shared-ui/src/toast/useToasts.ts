import { useState, useCallback } from "react";
import type { Toast, ToastType } from "./Toast";

export interface UseToastsReturn {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
  info: (title: string, message?: string) => string;
  success: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
}

/**
 * Hook for managing toast notifications.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { toasts, success, error, dismissToast } = useToasts();
 *
 *   const handleSave = async () => {
 *     try {
 *       await save();
 *       success("Saved", "Your changes have been saved");
 *     } catch (e) {
 *       error("Error", "Failed to save changes");
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleSave}>Save</button>
 *       <ToastContainer toasts={toasts} onDismiss={dismissToast} />
 *     </>
 *   );
 * }
 * ```
 */
export function useToasts(): UseToastsReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const createToastFn = useCallback(
    (type: ToastType) => (title: string, message?: string) =>
      addToast({ type, title, message }),
    [addToast]
  );

  return {
    toasts,
    addToast,
    dismissToast,
    clearToasts,
    info: createToastFn("info"),
    success: createToastFn("success"),
    warning: createToastFn("warning"),
    error: createToastFn("error"),
  };
}
