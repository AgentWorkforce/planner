import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PipelinePlanCard } from '../PipelinePlanCard';
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

describe('PipelinePlanCard', () => {
  describe('goal rendering', () => {
    it('renders plan goal', () => {
      const plan = createMockPlan();
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    });

    it('shows "Untitled Plan" when goal is empty', () => {
      const plan = createMockPlan({ goal: '' });
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      expect(screen.getByText('Untitled Plan')).toBeInTheDocument();
    });

    it('truncates goal with line-clamp-2', () => {
      const plan = createMockPlan({
        goal: 'This is a very long goal that should be truncated after two lines to keep the card compact and readable in the pipeline view',
      });
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const goalElement = container.querySelector('.line-clamp-2');
      expect(goalElement).toBeInTheDocument();
    });
  });

  describe('initiative badge', () => {
    it('shows initiative badge when initiative exists', () => {
      const plan = createMockPlan({
        initiative: {
          initiative_id: 'init-1',
          name: 'Q1 Launch',
          icon: '🚀',
          color: '#00d9ff',
        },
      });
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      expect(screen.getByText('Q1 Launch')).toBeInTheDocument();
      expect(screen.getByText('🚀')).toBeInTheDocument();
    });

    it('shows initiative without icon', () => {
      const plan = createMockPlan({
        initiative: {
          initiative_id: 'init-1',
          name: 'Q1 Launch',
        },
      });
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      expect(screen.getByText('Q1 Launch')).toBeInTheDocument();
    });

    it('hides initiative badge when no initiative', () => {
      const plan = createMockPlan();
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('truncates long initiative name', () => {
      const plan = createMockPlan({
        initiative: {
          initiative_id: 'init-1',
          name: 'Very Long Initiative Name That Should Be Truncated',
        },
      });
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const initiativeText = container.querySelector('.truncate');
      expect(initiativeText).toBeInTheDocument();
    });
  });

  describe('status dot', () => {
    it('shows gray dot for draft status', () => {
      const plan = createMockPlan({ status: 'draft' });
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const statusDot = container.querySelector('.bg-text-muted');
      expect(statusDot).toBeInTheDocument();
      expect(statusDot).toHaveAttribute('title', 'draft');
    });

    it('shows cyan dot for approved status', () => {
      const plan = createMockPlan({ status: 'approved' });
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const statusDot = container.querySelector('.bg-accent-cyan');
      expect(statusDot).toBeInTheDocument();
      expect(statusDot).toHaveAttribute('title', 'approved');
    });

    it('shows green dot for published status', () => {
      const plan = createMockPlan({ status: 'published' });
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const statusDot = container.querySelector('.bg-accent-green');
      expect(statusDot).toBeInTheDocument();
      expect(statusDot).toHaveAttribute('title', 'published');
    });
  });

  describe('gate indicator', () => {
    it('shows pulsing orange dot when plan has gate_pending attention', () => {
      const plan = createMockPlan({
        attention_types: ['gate_pending'],
      });
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const gateDot = container.querySelector('.bg-accent-orange.animate-pulse');
      expect(gateDot).toBeInTheDocument();
      expect(gateDot).toHaveAttribute('title', 'Awaiting approval');
    });

    it('applies orange border glow when plan has gate_pending', () => {
      const plan = createMockPlan({
        attention_types: ['gate_pending'],
      });
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('border-accent-orange', 'shadow-glow-orange');
    });

    it('hides gate indicator when no gate_pending attention', () => {
      const plan = createMockPlan({
        attention_types: ['active'],
      });
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const gateDot = container.querySelector('.bg-accent-orange.animate-pulse');
      expect(gateDot).not.toBeInTheDocument();
    });

    it('applies normal border when no gate_pending', () => {
      const plan = createMockPlan();
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('border-border-subtle');
      expect(link).not.toHaveClass('border-accent-orange');
    });
  });

  describe('linking behavior', () => {
    it('links to plan editor page', () => {
      const plan = createMockPlan({ plan_id: 'plan-123' });
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/plans/plan-123');
    });

    it('entire card is clickable', () => {
      const plan = createMockPlan();
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('block');
    });
  });

  describe('visual styling', () => {
    it('applies card background and border', () => {
      const plan = createMockPlan();
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('bg-bg-card', 'rounded-lg', 'border');
    });

    it('applies hover border transition', () => {
      const plan = createMockPlan();
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('hover:border-accent-cyan/50', 'transition-all');
    });

    it('applies custom className', () => {
      const plan = createMockPlan();
      renderWithRouter(<PipelinePlanCard plan={plan} className="custom-class" />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('custom-class');
    });
  });

  describe('compact layout', () => {
    it('uses compact padding', () => {
      const plan = createMockPlan();
      renderWithRouter(<PipelinePlanCard plan={plan} />);

      const link = screen.getByRole('link');
      expect(link).toHaveClass('p-3');
    });

    it('uses small font for goal', () => {
      const plan = createMockPlan();
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const heading = container.querySelector('h3');
      expect(heading).toHaveClass('text-sm', 'font-medium');
    });

    it('uses extra small font for initiative badge', () => {
      const plan = createMockPlan({
        initiative: {
          initiative_id: 'init-1',
          name: 'Q1 Launch',
        },
      });
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const badge = container.querySelector('.text-xs');
      expect(badge).toBeInTheDocument();
    });

    it('uses small status dots (w-2 h-2)', () => {
      const plan = createMockPlan();
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const statusDot = container.querySelector('.w-2.h-2.rounded-full');
      expect(statusDot).toBeInTheDocument();
    });
  });

  describe('multiple attention types', () => {
    it('shows gate indicator even with other attention types', () => {
      const plan = createMockPlan({
        attention_types: ['gate_pending', 'unread_comments', 'active'],
      });
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const gateDot = container.querySelector('.bg-accent-orange.animate-pulse');
      expect(gateDot).toBeInTheDocument();
    });

    it('handles empty attention_types array', () => {
      const plan = createMockPlan({
        attention_types: [],
      });
      const { container } = renderWithRouter(<PipelinePlanCard plan={plan} />);

      const gateDot = container.querySelector('.bg-accent-orange.animate-pulse');
      expect(gateDot).not.toBeInTheDocument();
    });
  });
});
