import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BoardColumn } from '../BoardColumn';
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

describe('BoardColumn', () => {
  describe('header rendering', () => {
    it('renders column title', () => {
      const plans = [createMockPlan()];
      renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      expect(screen.getByText('Drafting')).toBeInTheDocument();
    });

    it('renders plan count', () => {
      const plans = [
        createMockPlan({ plan_id: 'plan-1' }),
        createMockPlan({ plan_id: 'plan-2' }),
        createMockPlan({ plan_id: 'plan-3' }),
      ];
      renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows count of 0 when empty', () => {
      renderWithRouter(<BoardColumn title="Drafting" plans={[]} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('applies correct header styling', () => {
      const plans = [createMockPlan()];
      renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      const title = screen.getByText('Drafting');
      expect(title).toHaveClass('font-medium', 'text-sm', 'text-text-primary');

      const count = screen.getByText('1');
      expect(count).toHaveClass('text-text-muted', 'text-sm');
    });
  });

  describe('plan cards rendering', () => {
    it('renders PipelinePlanCards for each plan', () => {
      const plans = [
        createMockPlan({ plan_id: 'plan-1', goal: 'First plan' }),
        createMockPlan({ plan_id: 'plan-2', goal: 'Second plan' }),
      ];
      renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      expect(screen.getByText('First plan')).toBeInTheDocument();
      expect(screen.getByText('Second plan')).toBeInTheDocument();
    });

    it('renders cards in vertical stack with gap', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      const stack = container.querySelector('.flex.flex-col.gap-2');
      expect(stack).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows "No plans" message when plans array is empty', () => {
      renderWithRouter(<BoardColumn title="Drafting" plans={[]} />);

      expect(screen.getByText('No plans')).toBeInTheDocument();
    });

    it('does not render plan cards when empty', () => {
      const { container } = renderWithRouter(<BoardColumn title="Drafting" plans={[]} />);

      const links = container.querySelectorAll('a');
      expect(links).toHaveLength(0);
    });

    it('styles empty message correctly', () => {
      renderWithRouter(<BoardColumn title="Drafting" plans={[]} />);

      const emptyMessage = screen.getByText('No plans');
      expect(emptyMessage).toHaveClass('text-center', 'text-text-muted', 'text-sm', 'py-4');
    });
  });

  describe('variant styling', () => {
    it('applies "default" variant styles', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(
        <BoardColumn title="Drafting" plans={plans} variant="default" />
      );

      const column = container.querySelector('.bg-bg-secondary\\/20');
      expect(column).toBeInTheDocument();
      expect(column).toHaveClass('rounded-lg', 'border', 'border-border-subtle');
    });

    it('applies "gate" variant styles (orange highlight with glow)', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(
        <BoardColumn title="At Gate" plans={plans} variant="gate" />
      );

      const column = container.querySelector('.bg-accent-orange\\/10');
      expect(column).toBeInTheDocument();
      expect(column).toHaveClass(
        'rounded-lg',
        'border-t-2',
        'border-accent-orange',
        'shadow-glow-orange'
      );
    });

    it('applies "running" variant styles (cyan accent)', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(
        <BoardColumn title="Running" plans={plans} variant="running" />
      );

      const column = container.querySelector('.bg-accent-cyan\\/5');
      expect(column).toBeInTheDocument();
      expect(column).toHaveClass('rounded-lg', 'border', 'border-accent-cyan/30');
    });

    it('applies "complete" variant styles (green accent)', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(
        <BoardColumn title="Complete" plans={plans} variant="complete" />
      );

      const column = container.querySelector('.bg-accent-green\\/5');
      expect(column).toBeInTheDocument();
      expect(column).toHaveClass('rounded-lg', 'border', 'border-accent-green/20');
    });

    it('defaults to "default" variant when not specified', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      const column = container.querySelector('.bg-bg-secondary\\/20');
      expect(column).toBeInTheDocument();
    });
  });

  describe('layout and dimensions', () => {
    it('uses flex-1 min-w-0 for equal width Kanban columns', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      // Implementation uses flex-1 min-w-0 for Kanban-style equal width columns
      const column = container.querySelector('.flex-1.min-w-0');
      expect(column).toBeInTheDocument();
    });

    it('allows columns to share space equally with flex-1', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      const column = container.querySelector('.flex-1');
      expect(column).toBeInTheDocument();
    });

    it('applies padding to column', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      const column = container.querySelector('.p-3');
      expect(column).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(
        <BoardColumn title="Drafting" plans={plans} className="custom-class" />
      );

      const column = container.querySelector('.custom-class');
      expect(column).toBeInTheDocument();
    });
  });

  describe('header layout', () => {
    it('displays header with space between title and count', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      const header = container.querySelector('.flex.items-center.justify-between');
      expect(header).toBeInTheDocument();
    });

    it('applies bottom margin to header', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      const header = container.querySelector('.mb-3');
      expect(header).toBeInTheDocument();
    });
  });

  describe('content organization', () => {
    it('keeps plan cards compact', () => {
      const plans = [
        createMockPlan({ plan_id: 'plan-1' }),
        createMockPlan({ plan_id: 'plan-2' }),
      ];
      const { container } = renderWithRouter(<BoardColumn title="Drafting" plans={plans} />);

      const cardStack = container.querySelector('.gap-2');
      expect(cardStack).toBeInTheDocument();
    });
  });
});
