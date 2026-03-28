import { useState, useEffect, useCallback } from 'react';

// Event names for command palette state
const COMMAND_PALETTE_OPEN_EVENT = 'command-palette-open';
const COMMAND_PALETTE_CLOSE_EVENT = 'command-palette-close';
const COMMAND_PALETTE_TOGGLE_EVENT = 'command-palette-toggle';

/**
 * Open the command palette from anywhere in the app.
 * Can be called outside of React components.
 */
export function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT));
}

/**
 * Close the command palette from anywhere in the app.
 * Can be called outside of React components.
 */
export function closeCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_CLOSE_EVENT));
}

/**
 * Toggle the command palette from anywhere in the app.
 * Can be called outside of React components.
 */
export function toggleCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_TOGGLE_EVENT));
}

// Register keyboard shortcut globally (singleton - only once per module load)
// This ensures Cmd+K works even if multiple components use useCommandPalette
function registerGlobalKeyboardShortcut(): void {
  function handleKeyDown(e: KeyboardEvent) {
    // Cmd+K on Mac, Ctrl+K on Windows/Linux
    const isMac = navigator.userAgent.toUpperCase().includes('MAC');
    const isShortcut = isMac
      ? e.metaKey && e.key === 'k'
      : e.ctrlKey && e.key === 'k';

    if (isShortcut) {
      e.preventDefault();
      toggleCommandPalette();
    }
  }

  document.addEventListener('keydown', handleKeyDown);
}

// Register immediately when module loads
if (typeof document !== 'undefined') {
  registerGlobalKeyboardShortcut();
}

/**
 * Hook that manages command palette open/close state and listens for
 * Cmd+K (Mac) / Ctrl+K (Windows/Linux) globally.
 *
 * All instances of this hook share state through global events.
 *
 * Returns { isOpen, open, close, toggle }
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    openCommandPalette();
  }, []);

  const close = useCallback(() => {
    closeCommandPalette();
  }, []);

  const toggle = useCallback(() => {
    toggleCommandPalette();
  }, []);

  // Listen for global open/close/toggle events
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);
    const handleToggle = () => setIsOpen((prev) => !prev);

    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpen);
    window.addEventListener(COMMAND_PALETTE_CLOSE_EVENT, handleClose);
    window.addEventListener(COMMAND_PALETTE_TOGGLE_EVENT, handleToggle);

    return () => {
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handleOpen);
      window.removeEventListener(COMMAND_PALETTE_CLOSE_EVENT, handleClose);
      window.removeEventListener(COMMAND_PALETTE_TOGGLE_EVENT, handleToggle);
    };
  }, []);

  // Note: Keyboard shortcut (Cmd+K / Ctrl+K) is registered globally at module load
  // to ensure it only fires once, regardless of how many components use this hook.

  return { isOpen, open, close, toggle };
}
