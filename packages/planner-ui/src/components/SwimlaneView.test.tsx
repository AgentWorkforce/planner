import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwimlaneView } from './SwimlaneView';
import type { Step } from '@/types';

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

      // Both backend steps should be in the backend lane
      const backendLane = screen.getByText('backend').closest('.swimlane-lane') as HTMLElement;
      expect(backendLane).toBeInTheDocument();
      expect(within(backendLane).getByText('Step a')).toBeInTheDocument();
      expect(within(backendLane).getByText('Step c')).toBeInTheDocument();
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

      const lanes = screen.getAllByText(/alpha|zebra|General/);
      expect(lanes[0]).toHaveTextContent('alpha');
      expect(lanes[1]).toHaveTextContent('zebra');
      expect(lanes[2]).toHaveTextContent('General');
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

    it('highlights selected step', () => {
      const steps = [createStep('a', 'backend'), createStep('b', 'backend')];
      render(
        <SwimlaneView
          steps={steps}
          onStepClick={vi.fn()}
          selectedStepId="a"
        />
      );

      const card = screen.getByText('Step a').closest('.swimlane-step-card');
      expect(card).toHaveClass('swimlane-step-card--selected');
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

      const card = screen.getByText('Step a').closest('.swimlane-step-card');
      expect(card).toHaveClass('swimlane-step-card--highlighted');
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

      const card = screen.getByText('Step a').closest('.swimlane-step-card') as HTMLElement;

      await user.hover(card);
      expect(onStepHover).toHaveBeenCalledWith('a');

      await user.unhover(card);
      expect(onStepHover).toHaveBeenCalledWith(null);
    });
  });

  describe('step ordering', () => {
    it('orders steps by dependency depth (topological sort)', () => {
      const steps = [
        createStep('c', 'backend', ['b']),
        createStep('a', 'backend', []),
        createStep('b', 'backend', ['a']),
      ];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      // Get step cards in the backend lane
      const lane = screen.getByText('backend').closest('.swimlane-lane') as HTMLElement;
      const cards = within(lane).getAllByText(/^Step [abc]$/);

      // Should be ordered a -> b -> c by dependency
      expect(cards[0]).toHaveTextContent('Step a');
      expect(cards[1]).toHaveTextContent('Step b');
      expect(cards[2]).toHaveTextContent('Step c');
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
    it('shows completion stats in lane labels', () => {
      const steps = [
        createStep('a', 'backend', [], 'done'),
        createStep('b', 'backend', [], 'pending'),
      ];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      // ScopeSummaryStats should show "1/2 complete" in compact mode
      expect(screen.getByText('1/2 complete')).toBeInTheDocument();
    });
  });

  describe('status colors', () => {
    it('applies correct status color to done steps', () => {
      const steps = [createStep('a', 'backend', [], 'done')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      const card = screen.getByText('Step a').closest('.swimlane-step-card');
      // Card should have green-ish background for done status
      expect(card).toHaveStyle({ backgroundColor: '#dcfce7' });
    });

    it('applies correct status color to running steps', () => {
      const steps = [createStep('a', 'backend', [], 'running')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      const card = screen.getByText('Step a').closest('.swimlane-step-card');
      // Card should have blue-ish background for running status
      expect(card).toHaveStyle({ backgroundColor: '#dbeafe' });
    });

    it('applies correct status color to blocked steps', () => {
      const steps = [createStep('a', 'backend', [], 'blocked')];
      render(<SwimlaneView steps={steps} onStepClick={vi.fn()} />);

      const card = screen.getByText('Step a').closest('.swimlane-step-card');
      // Card should have yellow-ish background for blocked status
      expect(card).toHaveStyle({ backgroundColor: '#fef3c7' });
    });
  });
});
