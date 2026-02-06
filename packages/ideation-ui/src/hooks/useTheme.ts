import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'ideation-theme';

/**
 * Get the resolved theme (light or dark) based on system preference
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * useTheme - Hook for managing theme state
 *
 * Supports three modes:
 * - 'light': Force light theme
 * - 'dark': Force dark theme
 * - 'system': Follow system preference
 *
 * Persists preference to localStorage and applies to document.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem(THEME_KEY) as Theme) || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem(THEME_KEY) as Theme;
    if (stored === 'light') return 'light';
    if (stored === 'dark') return 'dark';
    return getSystemTheme();
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove('theme-light', 'theme-dark');

    if (theme === 'system') {
      // Let CSS media query handle it
      setResolvedTheme(getSystemTheme());
    } else {
      // Apply explicit theme class
      root.classList.add(`theme-${theme}`);
      setResolvedTheme(theme);
    }
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setResolvedTheme(getSystemTheme());
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    // Simple toggle: light -> dark -> light
    setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  }, [resolvedTheme, setTheme]);

  return {
    theme,           // Current setting: 'light' | 'dark' | 'system'
    resolvedTheme,   // Actual theme: 'light' | 'dark'
    setTheme,
    toggleTheme,
  };
}
