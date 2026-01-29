import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { DependencyLinesOverlay } from './DependencyLinesOverlay';
import type { Step } from '@/types';

// Mock the useDependencyPositions hook
vi.mock('@/hooks/useDependencyPositions', () => ({
  useDependencyPositions: vi.fn().mockReturnValue(new Map()),
}));

import { useDependencyPositions } from '@/hooks/useDependencyPositions';

function createStep(id: string, deps: string[] = [], scope?: string): Step {
  return {
    step_id: id,
    title: `Step ${id}`,
    description: `Description for ${id}`,
    dependencies: deps,
    scope,
    acceptance_criteria: [],
  };
}

function createMockPositions(
  positions: Record<string, { x: number; y: number; width: number; height: number }>
) {
  const map = new Map<string, DOMRect>();
  for (const [id, pos] of Object.entries(positions)) {
    map.set(
      id,
      new DOMRect(pos.x, pos.y, pos.width, pos.height)
    );
  }
  return map;
}

describe('DependencyLinesOverlay', () => {
  const mockContainerRef = { current: document.createElement('div') };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SVG container', () => {
    it('renders an SVG element', () => {
      vi.mocked(useDependencyPositions).mockReturnValue(new Map());
      render(
        <DependencyLinesOverlay
          steps={[]}
          containerRef={mockContainerRef}
          viewMode="list"
        />
      );

      expect(document.querySelector('svg')).toBeInTheDocument();
    });

    it('renders arrowhead marker definition', () => {
      vi.mocked(useDependencyPositions).mockReturnValue(new Map());
      render(
        <DependencyLinesOverlay
          steps={[]}
          containerRef={mockContainerRef}
          viewMode="list"
        />
      );

      const marker = document.querySelector('marker#arrowhead');
      expect(marker).toBeInTheDocument();
      expect(marker?.getAttribute('markerWidth')).toBe('8');
      expect(marker?.getAttribute('markerHeight')).toBe('8');
    });
  });

  describe('line rendering', () => {
    it('renders lines for dependencies', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [createStep('a'), createStep('b', ['a'])];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
        />
      );

      const paths = document.querySelectorAll('path.dependency-line');
      expect(paths.length).toBe(1);
    });

    it('does not render lines when positions are missing', () => {
      vi.mocked(useDependencyPositions).mockReturnValue(new Map());

      const steps = [createStep('a'), createStep('b', ['a'])];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
        />
      );

      const paths = document.querySelectorAll('path.dependency-line');
      expect(paths.length).toBe(0);
    });
  });

  describe('intra-scope vs cross-scope styling', () => {
    it('applies intra-scope class for same-scope dependencies', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [
        createStep('a', [], 'backend'),
        createStep('b', ['a'], 'backend'),
      ];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
        />
      );

      const path = document.querySelector('path.dependency-line');
      expect(path).toHaveClass('dependency-line--intra');
    });

    it('applies cross-scope class for different-scope dependencies', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [
        createStep('a', [], 'backend'),
        createStep('b', ['a'], 'frontend'),
      ];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
        />
      );

      const path = document.querySelector('path.dependency-line');
      expect(path).toHaveClass('dependency-line--cross');
    });

    it('uses dashed stroke for cross-scope lines', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [
        createStep('a', [], 'backend'),
        createStep('b', ['a'], 'frontend'),
      ];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
        />
      );

      const path = document.querySelector('path.dependency-line--cross');
      expect(path?.getAttribute('stroke-dasharray')).toBe('6 4');
    });
  });

  describe('highlighted state', () => {
    it('applies highlighted class to lines connected to hovered step', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [createStep('a'), createStep('b', ['a'])];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
          hoveredStepId="a"
        />
      );

      const path = document.querySelector('path.dependency-line');
      expect(path).toHaveClass('dependency-line--highlighted');
    });

    it('highlights lines for both source and target hover', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [createStep('a'), createStep('b', ['a'])];

      // Hover on target step
      const { rerender } = render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
          hoveredStepId="b"
        />
      );

      let path = document.querySelector('path.dependency-line');
      expect(path).toHaveClass('dependency-line--highlighted');

      // Hover on source step
      rerender(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
          hoveredStepId="a"
        />
      );

      path = document.querySelector('path.dependency-line');
      expect(path).toHaveClass('dependency-line--highlighted');
    });
  });

  describe('critical path', () => {
    it('applies critical class to critical path lines', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [createStep('a'), createStep('b', ['a'])];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
          criticalPath={new Set(['a', 'b'])}
        />
      );

      const path = document.querySelector('path.dependency-line');
      expect(path).toHaveClass('dependency-line--critical');
    });
  });

  describe('view mode paths', () => {
    it('generates vertical paths in list view', () => {
      const positions = createMockPositions({
        a: { x: 50, y: 0, width: 100, height: 50 },
        b: { x: 50, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [
        createStep('a', [], 'scope'),
        createStep('b', ['a'], 'scope'),
      ];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
        />
      );

      const path = document.querySelector('path.dependency-line');
      const d = path?.getAttribute('d') || '';
      // In list view for intra-scope, path should be vertical (M x1 y1 L x2 y2)
      expect(d).toContain('M');
      expect(d).toContain('L');
    });

    it('generates horizontal paths in swimlane view for intra-scope', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 50, width: 100, height: 50 },
        b: { x: 200, y: 50, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [
        createStep('a', [], 'scope'),
        createStep('b', ['a'], 'scope'),
      ];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="swimlane"
        />
      );

      const path = document.querySelector('path.dependency-line');
      expect(path).toBeInTheDocument();
    });
  });

  describe('multiple dependencies', () => {
    it('renders multiple lines for step with multiple dependencies', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 150, y: 0, width: 100, height: 50 },
        c: { x: 75, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [
        createStep('a'),
        createStep('b'),
        createStep('c', ['a', 'b']),
      ];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
        />
      );

      const paths = document.querySelectorAll('path.dependency-line');
      expect(paths.length).toBe(2); // a->c and b->c
    });
  });
});
