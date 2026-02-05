import { useState, useEffect } from 'react';

/**
 * useMediaQuery
 *
 * Hook to detect if a media query matches
 *
 * @param query - Media query string (e.g., '(min-width: 768px)')
 * @returns boolean - true if the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Set initial value
    setMatches(mediaQuery.matches);

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

/**
 * useIsMobile
 *
 * Convenience hook to detect mobile viewport
 * Mobile is defined as < 768px (Tailwind md breakpoint)
 *
 * @returns boolean - true if viewport is mobile size
 *
 * @example
 * ```tsx
 * const isMobile = useIsMobile();
 * if (isMobile) {
 *   // Render simplified mobile layout or disable physics
 * }
 * ```
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
