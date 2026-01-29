import { useRef, useEffect, useState } from 'react';
import type { Step } from '@/types';
import { useDependencyPositions } from '@/hooks/useDependencyPositions';
import type { ViewMode } from './ViewModeToggle';

interface DependencyLinesOverlayProps {
  steps: Step[];
  containerRef: React.RefObject<HTMLElement | null>;
  hoveredStepId?: string | null;
  viewMode: ViewMode;
  criticalPath?: Set<string>;
}

interface DependencyLine {
  fromId: string;
  toId: string;
  isCrossScope: boolean;
  isHighlighted: boolean;
  isCritical: boolean;
}

/**
 * Generate SVG path for a dependency line.
 * List view: vertical for intra-scope, bezier for cross-scope
 * Swimlane view: horizontal for intra-scope, bezier for cross-scope
 */
function generatePath(
  from: DOMRect,
  to: DOMRect,
  isCrossScope: boolean,
  viewMode: ViewMode
): string {
  if (viewMode === 'list') {
    if (isCrossScope) {
      // Bezier: source.right-center, control1 (+60px, 0), control2 (+60px, +dy), target.left-center
      const startX = from.right;
      const startY = from.y + from.height / 2;
      const endX = to.x;
      const endY = to.y + to.height / 2;
      const cp1X = startX + 60;
      const cp1Y = startY;
      const cp2X = endX - 60;
      const cp2Y = endY;
      return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
    } else {
      // Vertical: source.bottom-center -> target.top-center
      const startX = from.x + from.width / 2;
      const startY = from.bottom;
      const endX = to.x + to.width / 2;
      const endY = to.y;
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }
  } else {
    // Swimlane view
    if (isCrossScope) {
      // Bezier: source.bottom-center, control1 (0, +40px), control2 (dx, +40px), target.top-center
      const startX = from.x + from.width / 2;
      const startY = from.bottom;
      const endX = to.x + to.width / 2;
      const endY = to.y;
      const cp1X = startX;
      const cp1Y = startY + 40;
      const cp2X = endX;
      const cp2Y = endY - 40;
      return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
    } else {
      // Horizontal: source.right-center -> target.left-center
      const startX = from.right;
      const startY = from.y + from.height / 2;
      const endX = to.x;
      const endY = to.y + to.height / 2;
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }
  }
}

export function DependencyLinesOverlay({
  steps,
  containerRef,
  hoveredStepId,
  viewMode,
  criticalPath = new Set(),
}: DependencyLinesOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const stepIds = steps.map((s) => s.step_id);
  const positions = useDependencyPositions(containerRef, stepIds);

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

  // Build set of hovered step's dependencies and dependents for highlighting
  const highlightedSteps = new Set<string>();
  if (hoveredStepId) {
    highlightedSteps.add(hoveredStepId);

    // Find all ancestors (steps this depends on)
    const findAncestors = (stepId: string) => {
      const step = steps.find((s) => s.step_id === stepId);
      if (step) {
        for (const depId of step.dependencies || []) {
          if (!highlightedSteps.has(depId)) {
            highlightedSteps.add(depId);
            findAncestors(depId);
          }
        }
      }
    };

    // Find all descendants (steps that depend on this)
    const findDescendants = (stepId: string) => {
      for (const step of steps) {
        if ((step.dependencies || []).includes(stepId)) {
          if (!highlightedSteps.has(step.step_id)) {
            highlightedSteps.add(step.step_id);
            findDescendants(step.step_id);
          }
        }
      }
    };

    findAncestors(hoveredStepId);
    findDescendants(hoveredStepId);
  }

  // Compute all dependency lines
  const lines: DependencyLine[] = [];
  for (const step of steps) {
    for (const depId of step.dependencies || []) {
      if (stepIds.includes(depId)) {
        const fromScope = scopeMap.get(depId) || '';
        const toScope = scopeMap.get(step.step_id) || '';
        const isCrossScope = fromScope !== toScope;
        const isHighlighted = highlightedSteps.has(depId) && highlightedSteps.has(step.step_id);
        const isCritical = criticalPath.has(depId) && criticalPath.has(step.step_id);

        lines.push({
          fromId: depId,
          toId: step.step_id,
          isCrossScope,
          isHighlighted,
          isCritical,
        });
      }
    }
  }

  return (
    <svg
      ref={svgRef}
      className="dependency-lines-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: dimensions.width,
        height: dimensions.height,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      <defs>
        {/* Arrowhead marker 8x8 */}
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--color-border)" />
        </marker>
        <marker
          id="arrowhead-cross"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="#2563eb" />
        </marker>
        <marker
          id="arrowhead-highlight"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="#2563eb" />
        </marker>
        <marker
          id="arrowhead-critical"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="#ef4444" />
        </marker>
      </defs>

      {lines.map((line) => {
        const fromRect = positions.get(line.fromId);
        const toRect = positions.get(line.toId);

        if (!fromRect || !toRect) return null;

        const path = generatePath(fromRect, toRect, line.isCrossScope, viewMode);

        // Determine style based on line type
        let stroke = '#e2e8f0'; // intra-scope
        let strokeWidth = 2;
        let strokeDasharray = 'none';
        let opacity = 0.6;
        let filter = '';
        let marker = 'url(#arrowhead)';

        if (line.isCrossScope) {
          stroke = '#2563eb';
          strokeDasharray = '6 4';
          opacity = 0.7;
          marker = 'url(#arrowhead-cross)';
        }

        if (line.isCritical) {
          stroke = '#ef4444';
          strokeDasharray = 'none';
          opacity = 0.8;
          marker = 'url(#arrowhead-critical)';
        }

        if (line.isHighlighted) {
          stroke = '#2563eb';
          strokeWidth = 3;
          opacity = 1.0;
          filter = 'drop-shadow(0 0 3px #2563eb)';
          marker = 'url(#arrowhead-highlight)';
        }

        return (
          <g key={`${line.fromId}-${line.toId}`}>
            <path
              className={`dependency-line dependency-line--${line.isCrossScope ? 'cross' : 'intra'}${line.isHighlighted ? ' dependency-line--highlighted' : ''}${line.isCritical ? ' dependency-line--critical' : ''}`}
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray === 'none' ? undefined : strokeDasharray}
              opacity={opacity}
              style={{ filter: filter || undefined }}
              markerEnd={marker}
            />
            {/* Invisible wider path for hover detection */}
            <title>
              {steps.find((s) => s.step_id === line.toId)?.title || line.toId} depends on{' '}
              {steps.find((s) => s.step_id === line.fromId)?.title || line.fromId}
            </title>
          </g>
        );
      })}
    </svg>
  );
}
