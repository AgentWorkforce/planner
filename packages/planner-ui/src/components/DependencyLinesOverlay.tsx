import { useEffect, useState } from 'react';
import type { Step } from '@/types';
import { useDependencyPositions } from '@/hooks/useDependencyPositions';
import type { ViewMode } from './ViewModeToggle';

interface DependencyLinesOverlayProps {
  steps: Step[];
  containerRef: React.RefObject<HTMLElement | null>;
  hoveredStepId?: string | null;
  /** Direction being hovered: 'incoming' (left indicator) or 'outgoing' (right indicator) */
  hoveredDirection?: 'incoming' | 'outgoing' | null;
  viewMode: ViewMode;
  criticalPath?: Set<string>;
}

interface GutterLine {
  fromId: string;
  toId: string;
  direction: 'incoming' | 'outgoing';
  isCrossScope: boolean;
  isHighlighted: boolean;
  isCritical: boolean;
}

/**
 * Generate SVG path for a dependency line connecting two cards.
 *
 * Uses smooth cubic bezier curves that flow naturally between cards:
 * - Incoming (left): curve from source card to target card's left side
 * - Outgoing (right): curve from source card's right side to target card
 */
function generateGutterPath(
  from: DOMRect,
  to: DOMRect,
  direction: 'incoming' | 'outgoing',
  _containerWidth: number
): string {
  const sourceY = from.y + from.height / 2;
  const targetY = to.y + to.height / 2;
  const verticalDist = Math.abs(targetY - sourceY);

  // Control point offset based on vertical distance (min 30px, max 80px)
  const controlOffset = Math.min(80, Math.max(30, verticalDist * 0.4));

  if (direction === 'incoming') {
    // Connect from source's left edge to target's left edge
    const sourceX = from.x; // Left edge of source
    const targetX = to.x;   // Left edge of target

    // Start point: slightly left of source card
    const startX = sourceX - 8;
    const startY = sourceY;

    // End point: left edge of target (where indicator is)
    const endX = targetX - 8;
    const endY = targetY;

    // Cubic bezier with horizontal control points for smooth S-curve
    const cp1x = startX - controlOffset;
    const cp1y = startY;
    const cp2x = endX - controlOffset;
    const cp2y = endY;

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  } else {
    // Connect from source's right edge to target's right edge
    const sourceX = from.x + from.width; // Right edge of source
    const targetX = to.x + to.width;     // Right edge of target

    // Start point: right edge of source (where indicator is)
    const startX = sourceX + 8;
    const startY = sourceY;

    // End point: slightly right of target card
    const endX = targetX + 8;
    const endY = targetY;

    // Cubic bezier with horizontal control points for smooth S-curve
    const cp1x = startX + controlOffset;
    const cp1y = startY;
    const cp2x = endX + controlOffset;
    const cp2y = endY;

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  }
}

export function DependencyLinesOverlay({
  steps,
  containerRef,
  hoveredStepId,
  hoveredDirection,
  viewMode: _viewMode, // Kept for API compatibility; gutter approach works same for both modes
  criticalPath = new Set(),
}: DependencyLinesOverlayProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const stepIds = steps.map((s) => s.step_id);
  // Only compute positions when actually hovering
  const positions = useDependencyPositions(containerRef, stepIds, !!hoveredStepId);

  // Update SVG dimensions to match container
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.scrollWidth,
          height: containerRef.current.scrollHeight,
        });
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [containerRef]);

  // Build scope map for cross-scope detection
  const scopeMap = new Map<string, string>();
  for (const step of steps) {
    scopeMap.set(step.step_id, step.scope || '');
  }

  // Build dependency maps for quick lookup
  const incomingDeps = new Map<string, string[]>(); // stepId -> [steps it depends on]
  const outgoingDeps = new Map<string, string[]>(); // stepId -> [steps that depend on it]

  for (const step of steps) {
    incomingDeps.set(step.step_id, step.dependencies || []);
    for (const depId of step.dependencies || []) {
      if (!outgoingDeps.has(depId)) {
        outgoingDeps.set(depId, []);
      }
      outgoingDeps.get(depId)!.push(step.step_id);
    }
  }

  // Only render lines when a step is hovered
  if (!hoveredStepId) {
    return null;
  }

  // Compute lines to render based on hover state
  const lines: GutterLine[] = [];

  // If hovering step card (no specific direction), show both incoming and outgoing
  // If hovering specific indicator, only show that direction
  const showIncoming = !hoveredDirection || hoveredDirection === 'incoming';
  const showOutgoing = !hoveredDirection || hoveredDirection === 'outgoing';

  if (showIncoming) {
    // Incoming lines: what the hovered step depends on
    const deps = incomingDeps.get(hoveredStepId) || [];
    for (const depId of deps) {
      if (stepIds.includes(depId)) {
        const fromScope = scopeMap.get(depId) || '';
        const toScope = scopeMap.get(hoveredStepId) || '';
        const isCrossScope = fromScope !== toScope;
        const isCritical = criticalPath.has(depId) && criticalPath.has(hoveredStepId);

        lines.push({
          fromId: depId,
          toId: hoveredStepId,
          direction: 'incoming',
          isCrossScope,
          isHighlighted: true,
          isCritical,
        });
      }
    }
  }

  if (showOutgoing) {
    // Outgoing lines: steps that depend on the hovered step
    const dependents = outgoingDeps.get(hoveredStepId) || [];
    for (const depId of dependents) {
      if (stepIds.includes(depId)) {
        const fromScope = scopeMap.get(hoveredStepId) || '';
        const toScope = scopeMap.get(depId) || '';
        const isCrossScope = fromScope !== toScope;
        const isCritical = criticalPath.has(hoveredStepId) && criticalPath.has(depId);

        lines.push({
          fromId: hoveredStepId,
          toId: depId,
          direction: 'outgoing',
          isCrossScope,
          isHighlighted: true,
          isCritical,
        });
      }
    }
  }

  // Don't render if no lines
  if (lines.length === 0) {
    return null;
  }

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
        zIndex: 5, // Below cards (indicators at z-20)
        overflow: 'visible',
      }}
    >
      <defs>
        {/* Small circle markers instead of arrowheads */}
        <marker
          id="arrowhead-incoming"
          markerWidth="4"
          markerHeight="4"
          refX="2"
          refY="2"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="2" fill="#2563eb" />
        </marker>
        <marker
          id="arrowhead-outgoing"
          markerWidth="4"
          markerHeight="4"
          refX="2"
          refY="2"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="2" fill="#22c55e" />
        </marker>
        <marker
          id="arrowhead-cross"
          markerWidth="4"
          markerHeight="4"
          refX="2"
          refY="2"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="2" fill="#f59e0b" />
        </marker>
        <marker
          id="arrowhead-critical"
          markerWidth="4"
          markerHeight="4"
          refX="2"
          refY="2"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="2" fill="#ef4444" />
        </marker>
      </defs>

      {lines.map((line) => {
        const fromRect = positions.get(line.fromId);
        const toRect = positions.get(line.toId);

        if (!fromRect || !toRect) return null;

        const path = generateGutterPath(fromRect, toRect, line.direction, dimensions.width);

        // Determine style based on line type
        let stroke: string;
        let marker: string;

        if (line.isCritical) {
          stroke = '#ef4444'; // error red
          marker = 'url(#arrowhead-critical)';
        } else if (line.isCrossScope) {
          stroke = '#f59e0b'; // warning orange
          marker = 'url(#arrowhead-cross)';
        } else if (line.direction === 'incoming') {
          stroke = '#2563eb'; // blue
          marker = 'url(#arrowhead-incoming)';
        } else {
          stroke = '#22c55e'; // green
          marker = 'url(#arrowhead-outgoing)';
        }

        const strokeWidth = 2;
        const opacity = 1.0;
        const strokeDasharray = line.isCrossScope ? '6 4' : undefined;

        return (
          <g key={`${line.fromId}-${line.toId}-${line.direction}`}>
            <path
              className={`dependency-line dependency-line--${line.direction}${line.isCrossScope ? ' dependency-line--cross' : ''}${line.isCritical ? ' dependency-line--critical' : ''}`}
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              opacity={opacity}
              markerEnd={marker}
            />
            <title>
              {line.direction === 'incoming'
                ? `${steps.find((s) => s.step_id === line.toId)?.title} depends on ${steps.find((s) => s.step_id === line.fromId)?.title}`
                : `${steps.find((s) => s.step_id === line.toId)?.title} is blocked by ${steps.find((s) => s.step_id === line.fromId)?.title}`}
            </title>
          </g>
        );
      })}
    </svg>
  );
}
