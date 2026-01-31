import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'planner-theme';

/**
 * Get the effective theme (what the UI should display).
 * If 'system', resolves to light or dark based on prefers-color-scheme.
 */
function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Apply theme to the document by adding/removing theme-dark/theme-light classes.
 */
function applyTheme(theme: Theme) {
  const html = document.documentElement;

  // Add transitioning class for smooth theme change
  html.classList.add('theme-transitioning');

  // Remove existing theme classes
  html.classList.remove('theme-light', 'theme-dark');

  // Apply the appropriate class (skip for 'system' to use media query)
  if (theme !== 'system') {
    html.classList.add(`theme-${theme}`);
  }

  // Remove transitioning class after animation
  setTimeout(() => {
    html.classList.remove('theme-transitioning');
  }, 200);
}

/**
 * Hook to manage theme preference with localStorage persistence.
 *
 * Supports three modes:
 * - 'light': Force light theme
 * - 'dark': Force dark theme
 * - 'system': Follow system preference (prefers-color-scheme)
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { theme, effectiveTheme, setTheme, toggleTheme } = useTheme();
 *
 *   return (
 *     <button onClick={toggleTheme}>
 *       {effectiveTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored || 'system';
  });

  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() =>
    getEffectiveTheme(theme)
  );

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(theme);
    setEffectiveTheme(getEffectiveTheme(theme));
  }, [theme]);

  // Listen for system preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setEffectiveTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  }, []);

  // Simple toggle between light and dark (skips system)
  const toggleTheme = useCallback(() => {
    const newTheme = effectiveTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [effectiveTheme, setTheme]);

  return {
    /** Current theme setting ('light', 'dark', or 'system') */
    theme,
    /** Resolved theme for UI display ('light' or 'dark') */
    effectiveTheme,
    /** Set theme to a specific value */
    setTheme,
    /** Toggle between light and dark */
    toggleTheme,
  };
}
