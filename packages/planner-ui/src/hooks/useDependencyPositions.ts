import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook that tracks DOM positions for all step cards.
 * Returns a Map<stepId, DOMRect> updated on scroll/resize.
 * Only activates when `enabled` is true to avoid unnecessary work.
 */
export function useDependencyPositions(
  containerRef: React.RefObject<HTMLElement | null>,
  stepIds: string[],
  enabled: boolean = true
): Map<string, DOMRect> {
  const [positions, setPositions] = useState<Map<string, DOMRect>>(new Map());
  const rafRef = useRef<number | null>(null);

  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPositions = new Map<string, DOMRect>();

    for (const stepId of stepIds) {
      const element = containerRef.current.querySelector(`[data-step-id="${stepId}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
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
    // Only run when enabled (hovering)
    if (!enabled) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Immediate update when enabled
    updatePositions();

    // Throttled scroll handler
    const handleScroll = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          updatePositions();
        });
      }
    };

    const handleResize = () => updatePositions();

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [containerRef, updatePositions, enabled]);

  return positions;
}
