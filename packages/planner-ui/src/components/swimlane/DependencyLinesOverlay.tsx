import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Step } from '@/types';

interface DependencyLine {
  fromId: string;
  toId: string;
  isHighlighted: boolean;
  isCrossScope: boolean;
}

interface DependencyLinesOverlayProps {
  steps: Step[];
  containerRef: React.RefObject<HTMLElement | null>;
  hoveredStepId?: string | null;
}

// Indicator dot size (Tailwind w-2.5 = 10px, centered on card edge)
const INDICATOR_RADIUS = 5;

/**
 * Generate orthogonal (right-angle) path for dependency lines.
 * Connects from the GREEN outgoing indicator (right side of source)
 * to the BLUE incoming indicator (left side of target).
 */
function generateOrthogonalPath(from: DOMRect, to: DOMRect): string {
  // Connect to the indicator dots:
  // - Start from outer edge of outgoing (green) indicator on right side
  // - End at outer edge of incoming (blue) indicator on left side
  const startX = from.x + from.width + INDICATOR_RADIUS;
  const startY = from.y + from.height / 2;

  const endX = to.x - INDICATOR_RADIUS;
  const endY = to.y + to.height / 2;

  // Midpoint for vertical segment
  const midX = (startX + endX) / 2;

  // Orthogonal path: right → down/up → right
  return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
}

export function DependencyLinesOverlay({
  steps,
  containerRef,
  hoveredStepId,
}: DependencyLinesOverlayProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [positions, setPositions] = useState<Map<string, DOMRect>>(new Map());

  // Use ref to avoid recreating callback when steps array reference changes
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // Compute positions for all step cards
  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newPositions = new Map<string, DOMRect>();

    for (const step of stepsRef.current) {
      const el = container.querySelector(`[data-step-id="${step.step_id}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        newPositions.set(step.step_id, new DOMRect(
          rect.x - containerRect.x + container.scrollLeft,
          rect.y - containerRect.y + container.scrollTop,
          rect.width,
          rect.height
        ));
      }
    }

    // Only update if we found positions
    if (newPositions.size > 0) {
      setPositions(newPositions);
    }
  }, [containerRef]);

  // Update dimensions and positions
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.scrollWidth,
          height: containerRef.current.scrollHeight,
        });
        // Also update positions when dimensions change
        updatePositions();
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [containerRef, updatePositions]);

  // Watch for DOM changes (cards being added) and ensure positions are calculated
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new MutationObserver(() => {
      updatePositions();
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
    });

    // Multiple attempts to catch when DOM is ready
    const timers = [
      setTimeout(updatePositions, 0),
      setTimeout(updatePositions, 50),
      setTimeout(updatePositions, 150),
      setTimeout(updatePositions, 300),
    ];

    // Also update on next animation frame
    const raf = requestAnimationFrame(updatePositions);

    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [containerRef, updatePositions]);

  // Build ALL dependency lines (both same-scope and cross-scope)
  const lines: DependencyLine[] = useMemo(() => {
    const result: DependencyLine[] = [];
    const seen = new Set<string>();

    for (const step of steps) {
      const stepScope = step.scope || '';

      for (const depId of step.dependencies || []) {
        const depStep = steps.find((s) => s.step_id === depId);
        if (depStep) {
          const key = `${depId}-${step.step_id}`;
          if (!seen.has(key)) {
            seen.add(key);
            const isCrossScope = (depStep.scope || '') !== stepScope;
            // Highlight if either end is hovered
            const isHighlighted = hoveredStepId === step.step_id || hoveredStepId === depId;
            result.push({
              fromId: depId,
              toId: step.step_id,
              isHighlighted,
              isCrossScope,
            });
          }
        }
      }
    }

    return result;
  }, [steps, hoveredStepId]);

  if (lines.length === 0) {
    return null;
  }

  // Helper to create safe gradient IDs
  const safeId = (_from: string, _to: string, idx: number) => `gradient-${idx}`;

  return (
    <svg
      className="dependency-lines-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: dimensions.width,
        height: dimensions.height,
        pointerEvents: 'none',
        zIndex: 5,
        overflow: 'visible',
      }}
    >
      <defs>
        {/* Gradient from green (source/outgoing) to blue (target/incoming) */}
        {lines.map((line, idx) => {
          const fromRect = positions.get(line.fromId);
          const toRect = positions.get(line.toId);
          if (!fromRect || !toRect) return null;

          // Determine gradient direction based on relative positions
          const goingDown = toRect.y > fromRect.y;
          const goingRight = toRect.x > fromRect.x;

          return (
            <linearGradient
              key={safeId(line.fromId, line.toId, idx)}
              id={safeId(line.fromId, line.toId, idx)}
              x1={goingRight ? '0%' : '100%'}
              y1={goingDown ? '0%' : '100%'}
              x2={goingRight ? '100%' : '0%'}
              y2={goingDown ? '100%' : '0%'}
            >
              <stop offset="0%" stopColor="#22c55e" /> {/* Green at source */}
              <stop offset="100%" stopColor="#2563eb" /> {/* Blue at target */}
            </linearGradient>
          );
        })}
      </defs>

      {lines.map((line, idx) => {
        const fromRect = positions.get(line.fromId);
        const toRect = positions.get(line.toId);

        if (!fromRect || !toRect) return null;

        const path = generateOrthogonalPath(fromRect, toRect);
        const opacity = line.isHighlighted ? 1 : 0.4;
        const strokeWidth = line.isHighlighted ? 2.5 : 1.5;
        const gradientId = safeId(line.fromId, line.toId, idx);
        // Dashed for cross-scope, solid for same-scope
        const dashArray = line.isCrossScope ? '6 4' : undefined;

        return (
          <path
            key={`${line.fromId}-${line.toId}`}
            d={path}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            opacity={opacity}
            style={{ transition: 'opacity 0.15s, stroke-width 0.15s' }}
          />
        );
      })}
    </svg>
  );
}
