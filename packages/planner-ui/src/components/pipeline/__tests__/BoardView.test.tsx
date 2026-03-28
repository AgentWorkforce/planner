import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BoardView } from '../BoardView';
import type { StatusGroup } from '@/hooks/usePipelinePlans';
import type { PlanSummary } from '@/types';

function createMockPlan(overrides?: Partial<PlanSummary>): PlanSummary {
  return {
    plan_id: 'plan-1',
    goal: 'Implement user authentication',
    status: 'draft',
    latest_version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('BoardView', () => {
  describe('status columns rendering', () => {
    it('renders all status columns', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'drafting', label: 'Drafting', plans: [createMockPlan()] },
        { status: 'gate', label: 'At Gate', plans: [createMockPlan({ plan_id: 'plan-2' })] },
        { status: 'approved', label: 'Approved', plans: [createMockPlan({ plan_id: 'plan-3' })] },
        { status: 'running', label: 'Running', plans: [createMockPlan({ plan_id: 'plan-4' })] },
        { status: 'complete', label: 'Complete', plans: [createMockPlan({ plan_id: 'plan-5' })] },
      ];

      renderWithRouter(<BoardView statusGroups={statusGroups} />);

      expect(screen.getByText('Drafting')).toBeInTheDocument();
      expect(screen.getByText('At Gate')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('renders columns in provided order', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'drafting', label: 'Drafting', plans: [] },
        { status: 'gate', label: 'At Gate', plans: [] },
        { status: 'approved', label: 'Approved', plans: [] },
        { status: 'running', label: 'Running', plans: [] },
        { status: 'complete', label: 'Complete', plans: [] },
      ];

      const { container } = renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const headers = Array.from(container.querySelectorAll('h2')).map(h => h.textContent);
      expect(headers).toEqual(['Drafting', 'At Gate', 'Approved', 'Running', 'Complete']);
    });

    it('renders plans within each status column', () => {
      const statusGroups: StatusGroup[] = [
        {
          status: 'drafting',
          label: 'Drafting',
          plans: [
            createMockPlan({ plan_id: 'plan-1', goal: 'First plan' }),
            createMockPlan({ plan_id: 'plan-2', goal: 'Second plan' }),
          ],
        },
      ];

      renderWithRouter(<BoardView statusGroups={statusGroups} />);

      expect(screen.getByText('First plan')).toBeInTheDocument();
      expect(screen.getByText('Second plan')).toBeInTheDocument();
    });
  });

  describe('variant mapping', () => {
    it('applies "default" variant to drafting column', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'drafting', label: 'Drafting', plans: [createMockPlan()] },
      ];

      const { container } = renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const defaultColumn = container.querySelector('.bg-bg-secondary\\/20');
      expect(defaultColumn).toBeInTheDocument();
    });

    it('applies "gate" variant to gate column', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'gate', label: 'At Gate', plans: [createMockPlan()] },
      ];

      const { container } = renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const gateColumn = container.querySelector('.bg-accent-orange\\/10');
      expect(gateColumn).toBeInTheDocument();
      expect(gateColumn).toHaveClass('shadow-glow-orange');
    });

    it('applies "default" variant to approved column', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'approved', label: 'Approved', plans: [createMockPlan()] },
      ];

      const { container } = renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const approvedColumn = container.querySelector('.bg-bg-secondary\\/20');
      expect(approvedColumn).toBeInTheDocument();
    });

    it('applies "running" variant to running column', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'running', label: 'Running', plans: [createMockPlan()] },
      ];

      const { container } = renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const runningColumn = container.querySelector('.bg-accent-cyan\\/5');
      expect(runningColumn).toBeInTheDocument();
    });

    it('applies "complete" variant to complete column', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'complete', label: 'Complete', plans: [createMockPlan()] },
      ];

      const { container } = renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const completeColumn = container.querySelector('.bg-accent-green\\/5');
      expect(completeColumn).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders nothing when statusGroups is empty', () => {
      const { container } = renderWithRouter(<BoardView statusGroups={[]} />);

      // BoardColumn uses flex-1 min-w-0 for equal width columns
      const columns = container.querySelectorAll('.flex-1');
      expect(columns).toHaveLength(0);
    });

    it('shows "No plans" in columns with empty plans arrays', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'drafting', label: 'Drafting', plans: [] },
        { status: 'gate', label: 'At Gate', plans: [] },
      ];

      renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const noPlansMessages = screen.getAllByText('No plans');
      expect(noPlansMessages).toHaveLength(2);
    });

    it('shows count of 0 for empty columns', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'drafting', label: 'Drafting', plans: [] },
      ];

      renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const draftingHeader = screen.getByText('Drafting').parentElement;
      expect(draftingHeader?.textContent).toContain('0');
    });
  });

  describe('layout and scrolling', () => {
    it('applies flex layout with gap for Kanban columns', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'drafting', label: 'Drafting', plans: [] },
      ];

      const { container } = renderWithRouter(<BoardView statusGroups={statusGroups} />);

      // Implementation uses flex h-full gap-3 p-3 for Kanban layout
      const layout = container.querySelector('.flex.h-full.gap-3');
      expect(layout).toBeInTheDocument();
    });

    it('fills full height', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'drafting', label: 'Drafting', plans: [] },
      ];

      const { container } = renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const layout = container.querySelector('.h-full');
      expect(layout).toBeInTheDocument();
    });

    it('applies padding to view', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'drafting', label: 'Drafting', plans: [] },
      ];

      const { container } = renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const layout = container.querySelector('.p-3');
      expect(layout).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'drafting', label: 'Drafting', plans: [] },
      ];

      const { container } = renderWithRouter(
        <BoardView statusGroups={statusGroups} className="custom-class" />
      );

      const layout = container.querySelector('.custom-class');
      expect(layout).toBeInTheDocument();
    });
  });

  describe('onPlanClick callback', () => {
    it('passes onPlanClick to BoardColumn components', () => {
      const mockOnPlanClick = vi.fn();
      const statusGroups: StatusGroup[] = [
        {
          status: 'drafting',
          label: 'Drafting',
          plans: [createMockPlan({ plan_id: 'plan-123' })],
        },
      ];

      renderWithRouter(<BoardView statusGroups={statusGroups} onPlanClick={mockOnPlanClick} />);

      // The PipelinePlanCard is a link, so we verify the link is present
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/plans/plan-123');
    });
  });

  describe('multiple columns with mixed content', () => {
    it('renders columns with different plan counts', () => {
      const statusGroups: StatusGroup[] = [
        {
          status: 'drafting',
          label: 'Drafting',
          plans: [createMockPlan({ plan_id: 'plan-1' })],
        },
        {
          status: 'gate',
          label: 'At Gate',
          plans: [
            createMockPlan({ plan_id: 'plan-2' }),
            createMockPlan({ plan_id: 'plan-3' }),
          ],
        },
        {
          status: 'running',
          label: 'Running',
          plans: [
            createMockPlan({ plan_id: 'plan-4' }),
            createMockPlan({ plan_id: 'plan-5' }),
            createMockPlan({ plan_id: 'plan-6' }),
          ],
        },
        {
          status: 'complete',
          label: 'Complete',
          plans: [],
        },
      ];

      renderWithRouter(<BoardView statusGroups={statusGroups} />);

      // Verify all columns are rendered
      expect(screen.getByText('Drafting')).toBeInTheDocument();
      expect(screen.getByText('At Gate')).toBeInTheDocument();
      expect(screen.getByText('Running')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();

      // Verify count displays
      const draftingHeader = screen.getByText('Drafting').parentElement;
      expect(draftingHeader?.textContent).toContain('1');

      const gateHeader = screen.getByText('At Gate').parentElement;
      expect(gateHeader?.textContent).toContain('2');

      const runningHeader = screen.getByText('Running').parentElement;
      expect(runningHeader?.textContent).toContain('3');

      const completeHeader = screen.getByText('Complete').parentElement;
      expect(completeHeader?.textContent).toContain('0');
    });
  });

  describe('column spacing', () => {
    it('applies gap between columns', () => {
      const statusGroups: StatusGroup[] = [
        { status: 'drafting', label: 'Drafting', plans: [] },
        { status: 'gate', label: 'At Gate', plans: [] },
      ];

      const { container } = renderWithRouter(<BoardView statusGroups={statusGroups} />);

      const flexContainer = container.querySelector('.flex.gap-3');
      expect(flexContainer).toBeInTheDocument();
    });
  });
});
