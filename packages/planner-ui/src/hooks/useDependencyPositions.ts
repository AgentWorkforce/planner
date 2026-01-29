import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook that tracks DOM positions for all step cards.
 * Returns a Map<stepId, DOMRect> updated with 16ms debounce on scroll/resize/mutations.
 */
export function useDependencyPositions(
  containerRef: React.RefObject<HTMLElement | null>,
  stepIds: string[]
): Map<string, DOMRect> {
  const [positions, setPositions] = useState<Map<string, DOMRect>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const updatePositions = useCallback(() => {
    const now = performance.now();

    // Debounce: at most one update per 16ms (one frame)
    if (now - lastUpdateRef.current < 16) {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          updatePositions();
        });
      }
      return;
    }

    lastUpdateRef.current = now;

    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPositions = new Map<string, DOMRect>();

    for (const stepId of stepIds) {
      // Look for step cards by data attribute
      const element = containerRef.current.querySelector(`[data-step-id="${stepId}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        // Convert to container-relative coordinates
        const relativeRect = new DOMRect(
          rect.x - containerRect.x,
          rect.y - containerRect.y,
          rect.width,
          rect.height
        );
        newPositions.set(stepId, relativeRect);
      }
    }

    setPositions(newPositions);
  }, [containerRef, stepIds]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial update
    updatePositions();

    // Listen for scroll, resize, and mutations
    const handleScroll = () => updatePositions();
    const handleResize = () => updatePositions();

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // MutationObserver for DOM changes (expand/collapse, add/remove steps)
    const observer = new MutationObserver(() => {
      updatePositions();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [containerRef, updatePositions]);

  return positions;
}
