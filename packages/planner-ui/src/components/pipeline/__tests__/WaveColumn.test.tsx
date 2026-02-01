import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WaveColumn } from '../WaveColumn';
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

describe('WaveColumn', () => {
  describe('header rendering', () => {
    it('renders wave name in header', () => {
      const plans = [createMockPlan()];
      renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      expect(screen.getByText('NOW')).toBeInTheDocument();
    });

    it('renders wave name in uppercase', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<WaveColumn wave="Wave 2" plans={plans} />);

      const header = container.querySelector('.uppercase');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('Wave 2');
    });

    it('shows plan count badge', () => {
      const plans = [createMockPlan(), createMockPlan({ plan_id: 'plan-2' })];
      renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows correct count for single plan', () => {
      const plans = [createMockPlan()];
      renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('shows wave icon for numbered waves', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<WaveColumn wave="Wave 2" plans={plans} />);

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('hides wave icon for NOW wave', () => {
      const plans = [createMockPlan()];
      renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      const header = screen.getByText('NOW').parentElement;
      const icon = header?.querySelector('svg');
      expect(icon).not.toBeInTheDocument();
    });

    it('hides wave icon for DONE wave', () => {
      const plans = [createMockPlan()];
      renderWithRouter(<WaveColumn wave="DONE" plans={plans} />);

      const header = screen.getByText('DONE').parentElement;
      const icon = header?.querySelector('svg');
      expect(icon).not.toBeInTheDocument();
    });
  });

  describe('plan cards rendering', () => {
    it('renders PipelinePlanCards for each plan', () => {
      const plans = [
        createMockPlan({ plan_id: 'plan-1', goal: 'First plan' }),
        createMockPlan({ plan_id: 'plan-2', goal: 'Second plan' }),
        createMockPlan({ plan_id: 'plan-3', goal: 'Third plan' }),
      ];
      renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      expect(screen.getByText('First plan')).toBeInTheDocument();
      expect(screen.getByText('Second plan')).toBeInTheDocument();
      expect(screen.getByText('Third plan')).toBeInTheDocument();
    });

    it('renders cards in vertical stack', () => {
      const plans = [createMockPlan(), createMockPlan({ plan_id: 'plan-2' })];
      const { container } = renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      const stack = container.querySelector('.flex.flex-col.gap-2');
      expect(stack).toBeInTheDocument();
    });

    it('makes cards scrollable', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows "No plans" message when plans array is empty', () => {
      renderWithRouter(<WaveColumn wave="NOW" plans={[]} />);

      expect(screen.getByText('No plans')).toBeInTheDocument();
    });

    it('shows count of 0 when plans array is empty', () => {
      renderWithRouter(<WaveColumn wave="NOW" plans={[]} />);

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('does not render plan cards when empty', () => {
      const { container } = renderWithRouter(<WaveColumn wave="NOW" plans={[]} />);

      const links = container.querySelectorAll('a');
      expect(links).toHaveLength(0);
    });
  });

  describe('variant styling', () => {
    it('applies "now" variant styles (cyan highlight)', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(
        <WaveColumn wave="NOW" plans={plans} variant="now" />
      );

      const column = container.querySelector('.bg-accent-cyan\\/5');
      expect(column).toBeInTheDocument();
      expect(column).toHaveClass('border-t-2', 'border-accent-cyan/30');
    });

    it('applies "default" variant styles', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(
        <WaveColumn wave="Wave 2" plans={plans} variant="default" />
      );

      const column = container.querySelector('.bg-bg-secondary\\/30');
      expect(column).toBeInTheDocument();
      expect(column).toHaveClass('border-r', 'border-border-subtle');
    });

    it('applies "done" variant styles (green highlight)', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(
        <WaveColumn wave="DONE" plans={plans} variant="done" />
      );

      const column = container.querySelector('.bg-accent-green\\/5');
      expect(column).toBeInTheDocument();
      expect(column).toHaveClass('border-t-2', 'border-accent-green/20');
    });

    it('defaults to "default" variant when variant not specified', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<WaveColumn wave="Wave 2" plans={plans} />);

      const column = container.querySelector('.bg-bg-secondary\\/30');
      expect(column).toBeInTheDocument();
    });
  });

  describe('layout and dimensions', () => {
    it('uses flex-1 min-w-0 for equal width Kanban columns', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      // Implementation uses flex-1 min-w-0 for Kanban-style equal width columns
      const column = container.querySelector('.flex-1.min-w-0');
      expect(column).toBeInTheDocument();
    });

    it('allows columns to share space equally', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      const column = container.querySelector('.flex-1');
      expect(column).toBeInTheDocument();
    });

    it('uses flex column layout', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      const column = container.querySelector('.flex.flex-col');
      expect(column).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(
        <WaveColumn wave="NOW" plans={plans} className="custom-class" />
      );

      const column = container.querySelector('.custom-class');
      expect(column).toBeInTheDocument();
    });
  });

  describe('header styling', () => {
    it('applies border separator to header', () => {
      const plans = [createMockPlan()];
      renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      const header = screen.getByText('NOW').parentElement?.parentElement;
      expect(header).toHaveClass('border-b', 'border-border-subtle/50');
    });

    it('applies correct text styling to wave name', () => {
      const plans = [createMockPlan()];
      renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      const waveName = screen.getByText('NOW');
      expect(waveName).toHaveClass(
        'font-medium',
        'text-sm',
        'text-text-secondary',
        'uppercase',
        'tracking-wide'
      );
    });

    it('styles count badge correctly', () => {
      const plans = [createMockPlan()];
      renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      const countBadge = screen.getByText('1');
      expect(countBadge).toHaveClass(
        'px-2',
        'py-0.5',
        'rounded',
        'bg-bg-tertiary',
        'text-text-muted',
        'text-xs',
        'font-medium'
      );
    });
  });

  describe('content padding', () => {
    it('applies padding to content area', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      const content = container.querySelector('.p-3.flex-1');
      expect(content).toBeInTheDocument();
    });

    it('applies padding to header', () => {
      const plans = [createMockPlan()];
      const { container } = renderWithRouter(<WaveColumn wave="NOW" plans={plans} />);

      const header = container.querySelector('.p-3.pb-2');
      expect(header).toBeInTheDocument();
    });
  });
});
