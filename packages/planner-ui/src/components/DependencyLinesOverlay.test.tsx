import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { DependencyLinesOverlay } from './DependencyLinesOverlay';
import type { Step } from '@/types';

// Mock ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

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

  describe('when no step is hovered', () => {
    it('does not render anything', () => {
      vi.mocked(useDependencyPositions).mockReturnValue(new Map());
      render(
        <DependencyLinesOverlay
          steps={[createStep('a'), createStep('b', ['a'])]}
          containerRef={mockContainerRef}
          viewMode="list"
        />
      );

      // Should return null when not hovering
      expect(document.querySelector('svg')).not.toBeInTheDocument();
    });
  });

  describe('SVG container', () => {
    it('renders an SVG element when a step is hovered', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      render(
        <DependencyLinesOverlay
          steps={[createStep('a'), createStep('b', ['a'])]}
          containerRef={mockContainerRef}
          viewMode="list"
          hoveredStepId="a"
        />
      );

      expect(document.querySelector('svg')).toBeInTheDocument();
    });

    it('renders arrowhead markers in defs', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      render(
        <DependencyLinesOverlay
          steps={[createStep('a'), createStep('b', ['a'])]}
          containerRef={mockContainerRef}
          viewMode="list"
          hoveredStepId="a"
        />
      );

      // Uses separate markers for incoming, outgoing, and critical
      expect(document.querySelector('marker#arrowhead-incoming')).toBeInTheDocument();
      expect(document.querySelector('marker#arrowhead-outgoing')).toBeInTheDocument();
      expect(document.querySelector('marker#arrowhead-critical')).toBeInTheDocument();
    });
  });

  describe('line rendering', () => {
    it('renders outgoing lines when hovering a source step', () => {
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

      // Hovering 'a' shows outgoing lines to steps that depend on 'a'
      const paths = document.querySelectorAll('path.dependency-line');
      expect(paths.length).toBe(1);
      expect(paths[0]).toHaveClass('dependency-line--outgoing');
    });

    it('renders incoming lines when hovering a dependent step', () => {
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
          hoveredStepId="b"
        />
      );

      // Hovering 'b' shows incoming lines from steps 'b' depends on
      const paths = document.querySelectorAll('path.dependency-line');
      expect(paths.length).toBe(1);
      expect(paths[0]).toHaveClass('dependency-line--incoming');
    });

    it('does not render lines when positions are missing', () => {
      vi.mocked(useDependencyPositions).mockReturnValue(new Map());

      const steps = [createStep('a'), createStep('b', ['a'])];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
          hoveredStepId="b"
        />
      );

      // No paths since positions are empty
      const paths = document.querySelectorAll('path.dependency-line');
      expect(paths.length).toBe(0);
    });
  });

  describe('cross-scope styling', () => {
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
          hoveredStepId="b"
        />
      );

      const path = document.querySelector('path.dependency-line');
      expect(path).toHaveClass('dependency-line--cross');
    });

    it('does not apply cross-scope class for same-scope dependencies', () => {
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
          hoveredStepId="b"
        />
      );

      const path = document.querySelector('path.dependency-line');
      expect(path).not.toHaveClass('dependency-line--cross');
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
          hoveredStepId="b"
        />
      );

      const path = document.querySelector('path.dependency-line--cross');
      expect(path?.getAttribute('stroke-dasharray')).toBe('6 4');
    });
  });

  describe('direction filtering', () => {
    it('shows both directions when no hoveredDirection specified', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
        c: { x: 0, y: 200, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      // a <- b -> c (b depends on a, c depends on b)
      const steps = [
        createStep('a'),
        createStep('b', ['a']),
        createStep('c', ['b']),
      ];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
          hoveredStepId="b"
        />
      );

      // Hovering 'b' with no direction shows:
      // - incoming from 'a' (b depends on a)
      // - outgoing to 'c' (c depends on b)
      const paths = document.querySelectorAll('path.dependency-line');
      expect(paths.length).toBe(2);
    });

    it('shows only incoming when hoveredDirection is incoming', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
        c: { x: 0, y: 200, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [
        createStep('a'),
        createStep('b', ['a']),
        createStep('c', ['b']),
      ];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
          hoveredStepId="b"
          hoveredDirection="incoming"
        />
      );

      const paths = document.querySelectorAll('path.dependency-line');
      expect(paths.length).toBe(1);
      expect(paths[0]).toHaveClass('dependency-line--incoming');
    });

    it('shows only outgoing when hoveredDirection is outgoing', () => {
      const positions = createMockPositions({
        a: { x: 0, y: 0, width: 100, height: 50 },
        b: { x: 0, y: 100, width: 100, height: 50 },
        c: { x: 0, y: 200, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [
        createStep('a'),
        createStep('b', ['a']),
        createStep('c', ['b']),
      ];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
          hoveredStepId="b"
          hoveredDirection="outgoing"
        />
      );

      const paths = document.querySelectorAll('path.dependency-line');
      expect(paths.length).toBe(1);
      expect(paths[0]).toHaveClass('dependency-line--outgoing');
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
          hoveredStepId="b"
          criticalPath={new Set(['a', 'b'])}
        />
      );

      const path = document.querySelector('path.dependency-line');
      expect(path).toHaveClass('dependency-line--critical');
    });

    it('does not apply critical class when not on critical path', () => {
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
          hoveredStepId="b"
          criticalPath={new Set(['x', 'y'])} // different steps
        />
      );

      const path = document.querySelector('path.dependency-line');
      expect(path).not.toHaveClass('dependency-line--critical');
    });
  });

  describe('line paths', () => {
    it('generates paths with bezier curves', () => {
      const positions = createMockPositions({
        a: { x: 50, y: 0, width: 100, height: 50 },
        b: { x: 50, y: 100, width: 100, height: 50 },
      });
      vi.mocked(useDependencyPositions).mockReturnValue(positions);

      const steps = [createStep('a'), createStep('b', ['a'])];

      render(
        <DependencyLinesOverlay
          steps={steps}
          containerRef={mockContainerRef}
          viewMode="list"
          hoveredStepId="b"
        />
      );

      const path = document.querySelector('path.dependency-line');
      const d = path?.getAttribute('d') || '';
      // Should contain cubic bezier curve command
      expect(d).toContain('M');
      expect(d).toContain('C');
    });
  });

  describe('multiple dependencies', () => {
    it('renders multiple incoming lines for step with multiple dependencies', () => {
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
          hoveredStepId="c"
        />
      );

      const paths = document.querySelectorAll('path.dependency-line--incoming');
      expect(paths.length).toBe(2); // a->c and b->c
    });
  });
});
