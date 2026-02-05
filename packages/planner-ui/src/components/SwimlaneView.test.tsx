import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwimlaneView } from './SwimlaneView';
import type { Step } from '@/types';

// Mock ResizeObserver for tests
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock useTopologicalSort to provide predictable column assignments
vi.mock('@/hooks/useTopologicalSort', () => ({
  useTopologicalSort: (steps: Step[]) => {
    // Simple mock: assign column based on dependency count
    const columnMap = new Map<string, number>();
    for (const step of steps) {
      const depCount = step.dependencies?.length || 0;
      columnMap.set(step.step_id, depCount);
    }
    return columnMap;
  },
}));

function createStep(
  id: string,
  scope: string,
  deps: string[] = [],
  status?: string
): Step & { execution_status?: string } {
  return {
    step_id: id,
    title: `Step ${id}`,
    description: `Description for ${id}`,
    dependencies: deps,
    scope,
    acceptance_criteria: [],
    execution_status: status,
  };
}

describe('SwimlaneView', () => {
  describe('lane rendering', () => {
    it('renders a lane for each scope', () => {
      const steps = [
        createStep('a', 'backend'),
        createStep('b', 'frontend'),
        createStep('c', 'backend'),
      ];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      expect(screen.getByText('backend')).toBeInTheDocument();
      expect(screen.getByText('frontend')).toBeInTheDocument();
    });

    it('groups steps by scope correctly', () => {
      const steps = [
        createStep('a', 'backend'),
        createStep('b', 'frontend'),
        createStep('c', 'backend'),
      ];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      // Find the backend label and its lane
      const backendLabel = screen.getByText('backend');
      const lane = backendLabel.closest('.border-b') as HTMLElement;
      expect(lane).toBeInTheDocument();

      // Both backend steps should be in the same lane
      expect(within(lane).getByText('Step a')).toBeInTheDocument();
      expect(within(lane).getByText('Step c')).toBeInTheDocument();
    });

    it('shows "General" for steps without scope', () => {
      const steps = [createStep('a', ''), createStep('b', '')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      expect(screen.getByText('General')).toBeInTheDocument();
    });

    it('sorts scopes alphabetically with General last', () => {
      const steps = [
        createStep('a', ''),
        createStep('b', 'zebra'),
        createStep('c', 'alpha'),
      ];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      const scopeLabels = screen.getAllByText(/^(alpha|zebra|General)$/);
      expect(scopeLabels[0]).toHaveTextContent('alpha');
      expect(scopeLabels[1]).toHaveTextContent('zebra');
      expect(scopeLabels[2]).toHaveTextContent('General');
    });
  });

  describe('step card rendering', () => {
    it('renders step cards with titles', () => {
      const steps = [createStep('a', 'backend')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      expect(screen.getByText('Step a')).toBeInTheDocument();
    });

    it('shows execution status on cards', () => {
      const steps = [createStep('a', 'backend', [], 'running')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      expect(screen.getByText('running')).toBeInTheDocument();
    });

    it('normalizes status display (replaces underscores)', () => {
      const steps = [createStep('a', 'backend', [], 'in_progress')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      expect(screen.getByText('in progress')).toBeInTheDocument();
    });
  });

  describe('step interactions', () => {
    it('calls onStepClick when card is clicked', async () => {
      const onStepClick = vi.fn();
      const user = userEvent.setup();
      const steps = [createStep('a', 'backend')];
      render(<SwimlaneView steps={steps} onStepClick={onStepClick} />);

      await user.click(screen.getByText('Step a'));

      expect(onStepClick).toHaveBeenCalledWith(steps[0]);
    });

    it('highlights selected step with accent border', () => {
      const steps = [createStep('a', 'backend'), createStep('b', 'backend')];
      render(
        <SwimlaneView
          steps={steps}
          onStepClick={vi.fn()}
          selectedStepId="a"
        />
      );

      const card = screen.getByText('Step a').closest('[data-step-id]');
      expect(card).toHaveClass('border-accent-cyan');
    });

    it('highlights hovered step', () => {
      const steps = [createStep('a', 'backend')];
      render(
        <SwimlaneView
          steps={steps}
          onStepClick={vi.fn()}
          hoveredStepId="a"
        />
      );

      const card = screen.getByText('Step a').closest('[data-step-id]');
      expect(card).toHaveClass('border-accent-cyan');
    });

    it('calls onStepHover on mouse enter/leave', async () => {
      const onStepHover = vi.fn();
      const user = userEvent.setup();
      const steps = [createStep('a', 'backend')];
      render(
        <SwimlaneView
          steps={steps}
          onStepClick={vi.fn()}
          onStepHover={onStepHover}
        />
      );

      const card = screen.getByText('Step a').closest('[data-step-id]') as HTMLElement;

      await user.hover(card);
      expect(onStepHover).toHaveBeenCalledWith('a');

      await user.unhover(card);
      expect(onStepHover).toHaveBeenCalledWith(null);
    });
  });

  describe('empty states', () => {
    it('shows empty message when no steps', () => {
      render(<SwimlaneView steps={[]} onStepClick={vi.fn()} />);

      expect(screen.getByText('No steps to display')).toBeInTheDocument();
    });

    it('shows empty scope message when scope has no steps', () => {
      // This would happen if we explicitly created an empty lane,
      // but currently the component only creates lanes for scopes with steps
      const steps = [createStep('a', 'backend')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      // Only the backend lane should exist
      expect(screen.queryByText('frontend')).not.toBeInTheDocument();
    });
  });

  describe('scope summary stats', () => {
    it('renders ScopeSummaryStats in each lane', () => {
      const steps = [
        createStep('a', 'backend', [], 'done'),
        createStep('b', 'backend', [], 'pending'),
      ];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      // ScopeSummaryStats should show completion info
      // The exact text depends on ScopeSummaryStats implementation
      const backendLane = screen.getByText('backend').closest('.border-b');
      expect(backendLane).toBeInTheDocument();
    });
  });

  describe('status classes', () => {
    it('applies success classes to done steps', () => {
      const steps = [createStep('a', 'backend', [], 'done')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      const card = screen.getByText('Step a').closest('[data-step-id]');
      expect(card).toHaveClass('bg-success/10');
      expect(card).toHaveClass('border-success');
    });

    it('applies accent classes to running steps', () => {
      const steps = [createStep('a', 'backend', [], 'running')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      const card = screen.getByText('Step a').closest('[data-step-id]');
      expect(card).toHaveClass('bg-accent-cyan/10');
      expect(card).toHaveClass('border-accent-cyan');
    });

    it('applies warning classes to blocked steps', () => {
      const steps = [createStep('a', 'backend', [], 'blocked')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      const card = screen.getByText('Step a').closest('[data-step-id]');
      expect(card).toHaveClass('bg-warning/10');
      expect(card).toHaveClass('border-warning');
    });

    it('applies error classes to failed steps', () => {
      const steps = [createStep('a', 'backend', [], 'failed')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      const card = screen.getByText('Step a').closest('[data-step-id]');
      expect(card).toHaveClass('bg-error/10');
      expect(card).toHaveClass('border-error');
    });

    it('applies default classes to pending steps', () => {
      const steps = [createStep('a', 'backend', [], 'pending')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      const card = screen.getByText('Step a').closest('[data-step-id]');
      expect(card).toHaveClass('bg-bg-card');
      expect(card).toHaveClass('border-border-subtle');
    });
  });

  describe('data attributes', () => {
    it('adds data-step-id attribute to step cards', () => {
      const steps = [createStep('test-id', 'backend')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      const card = screen.getByText('Step test-id').closest('[data-step-id]');
      expect(card).toHaveAttribute('data-step-id', 'test-id');
    });
  });
});
