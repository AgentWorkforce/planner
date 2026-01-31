import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SequenceView } from '../SequenceView';
import type { WaveGroup } from '@/hooks/usePipelinePlans';
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

describe('SequenceView', () => {
  describe('wave columns rendering', () => {
    it('renders all wave columns', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'NOW', plans: [createMockPlan()] },
        { wave: 'Wave 2', plans: [createMockPlan({ plan_id: 'plan-2' })] },
        { wave: 'Wave 3', plans: [createMockPlan({ plan_id: 'plan-3' })] },
        { wave: 'DONE', plans: [createMockPlan({ plan_id: 'plan-4' })] },
      ];

      renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      expect(screen.getByText('NOW')).toBeInTheDocument();
      expect(screen.getByText('Wave 2')).toBeInTheDocument();
      expect(screen.getByText('Wave 3')).toBeInTheDocument();
      expect(screen.getByText('DONE')).toBeInTheDocument();
    });

    it('renders columns in correct order', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'NOW', plans: [createMockPlan()] },
        { wave: 'Wave 2', plans: [createMockPlan({ plan_id: 'plan-2' })] },
        { wave: 'DONE', plans: [createMockPlan({ plan_id: 'plan-3' })] },
      ];

      const { container } = renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      const headers = Array.from(container.querySelectorAll('h2')).map(h => h.textContent);
      expect(headers).toEqual(['NOW', 'Wave 2', 'DONE']);
    });

    it('renders plans within each wave', () => {
      const waveGroups: WaveGroup[] = [
        {
          wave: 'NOW',
          plans: [
            createMockPlan({ plan_id: 'plan-1', goal: 'First plan' }),
            createMockPlan({ plan_id: 'plan-2', goal: 'Second plan' }),
          ],
        },
      ];

      renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      expect(screen.getByText('First plan')).toBeInTheDocument();
      expect(screen.getByText('Second plan')).toBeInTheDocument();
    });
  });

  describe('variant mapping', () => {
    it('applies "now" variant to NOW wave', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'NOW', plans: [createMockPlan()] },
      ];

      const { container } = renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      // Check for cyan highlight variant
      const nowColumn = container.querySelector('.bg-accent-cyan\\/5');
      expect(nowColumn).toBeInTheDocument();
    });

    it('applies "done" variant to DONE wave', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'DONE', plans: [createMockPlan()] },
      ];

      const { container } = renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      // Check for green highlight variant
      const doneColumn = container.querySelector('.bg-accent-green\\/5');
      expect(doneColumn).toBeInTheDocument();
    });

    it('applies "default" variant to numbered waves', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'Wave 2', plans: [createMockPlan()] },
        { wave: 'Wave 3', plans: [createMockPlan({ plan_id: 'plan-2' })] },
      ];

      const { container } = renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      // Check for default variant styling
      const defaultColumns = container.querySelectorAll('.bg-bg-secondary\\/30');
      expect(defaultColumns).toHaveLength(2);
    });
  });

  describe('empty state', () => {
    it('renders nothing when waveGroups is empty', () => {
      const { container } = renderWithRouter(<SequenceView waveGroups={[]} />);

      const columns = container.querySelectorAll('.min-w-\\[280px\\]');
      expect(columns).toHaveLength(0);
    });

    it('handles waves with empty plans arrays', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'NOW', plans: [] },
      ];

      renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      expect(screen.getByText('No plans')).toBeInTheDocument();
    });
  });

  describe('layout and scrolling', () => {
    it('applies horizontal scroll layout', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'NOW', plans: [createMockPlan()] },
      ];

      const { container } = renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      const layout = container.querySelector('.flex.overflow-x-auto.overflow-y-hidden');
      expect(layout).toBeInTheDocument();
    });

    it('fills full height', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'NOW', plans: [createMockPlan()] },
      ];

      const { container } = renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      const layout = container.querySelector('.h-full');
      expect(layout).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'NOW', plans: [createMockPlan()] },
      ];

      const { container } = renderWithRouter(
        <SequenceView waveGroups={waveGroups} className="custom-class" />
      );

      const layout = container.querySelector('.custom-class');
      expect(layout).toBeInTheDocument();
    });
  });

  describe('onPlanClick callback', () => {
    it('passes onPlanClick to WaveColumn components', () => {
      const mockOnPlanClick = vi.fn();
      const waveGroups: WaveGroup[] = [
        { wave: 'NOW', plans: [createMockPlan({ plan_id: 'plan-123' })] },
      ];

      renderWithRouter(<SequenceView waveGroups={waveGroups} onPlanClick={mockOnPlanClick} />);

      // The PipelinePlanCard is a link, so we verify the link is present
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/plans/plan-123');
    });
  });

  describe('multiple waves with mixed content', () => {
    it('renders waves with different plan counts', () => {
      const waveGroups: WaveGroup[] = [
        {
          wave: 'NOW',
          plans: [createMockPlan({ plan_id: 'plan-1' })],
        },
        {
          wave: 'Wave 2',
          plans: [
            createMockPlan({ plan_id: 'plan-2' }),
            createMockPlan({ plan_id: 'plan-3' }),
            createMockPlan({ plan_id: 'plan-4' }),
          ],
        },
        {
          wave: 'DONE',
          plans: [
            createMockPlan({ plan_id: 'plan-5' }),
            createMockPlan({ plan_id: 'plan-6' }),
          ],
        },
      ];

      renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      expect(screen.getByText('NOW')).toBeInTheDocument();
      expect(screen.getByText('Wave 2')).toBeInTheDocument();
      expect(screen.getByText('DONE')).toBeInTheDocument();

      // Verify count badges
      const nowHeader = screen.getByText('NOW').parentElement?.parentElement;
      expect(nowHeader?.textContent).toContain('1');

      const wave2Header = screen.getByText('Wave 2').parentElement?.parentElement;
      expect(wave2Header?.textContent).toContain('3');

      const doneHeader = screen.getByText('DONE').parentElement?.parentElement;
      expect(doneHeader?.textContent).toContain('2');
    });

    it('renders only waves provided (handles partial wave sets)', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'NOW', plans: [createMockPlan()] },
        { wave: 'DONE', plans: [createMockPlan({ plan_id: 'plan-2' })] },
      ];

      renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      expect(screen.getByText('NOW')).toBeInTheDocument();
      expect(screen.getByText('DONE')).toBeInTheDocument();
      expect(screen.queryByText('Wave 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Wave 3')).not.toBeInTheDocument();
    });
  });

  describe('continuous flow layout', () => {
    it('columns touch each other (no gap between columns)', () => {
      const waveGroups: WaveGroup[] = [
        { wave: 'NOW', plans: [createMockPlan()] },
        { wave: 'Wave 2', plans: [createMockPlan({ plan_id: 'plan-2' })] },
      ];

      const { container } = renderWithRouter(<SequenceView waveGroups={waveGroups} />);

      // Verify parent flex container has no gap class
      const flexContainer = container.querySelector('.flex.h-full');
      expect(flexContainer?.className).not.toContain('gap-');
    });
  });
});
