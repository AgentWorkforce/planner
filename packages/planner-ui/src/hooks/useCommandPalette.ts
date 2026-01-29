import { useState, useEffect, useCallback } from 'react';

/**
 * Hook that manages command palette open/close state and listens for
 * Cmd+K (Mac) / Ctrl+K (Windows/Linux) globally.
 *
 * Returns { isOpen, open, close, toggle }
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K on Mac, Ctrl+K on Windows/Linux
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isShortcut = isMac
        ? e.metaKey && e.key === 'k'
        : e.ctrlKey && e.key === 'k';

      if (isShortcut) {
        e.preventDefault(); // Prevent browser address bar focus
        toggle();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { isOpen, open, close, toggle };
}
