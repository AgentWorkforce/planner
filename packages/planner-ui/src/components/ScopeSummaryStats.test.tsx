import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScopeSummaryStats } from './ScopeSummaryStats';
import type { Step } from '@/types';

function createStep(id: string, status?: string): Step & { execution_status?: string } {
  return {
    step_id: id,
    title: `Step ${id}`,
    description: `Description for ${id}`,
    dependencies: [],
    acceptance_criteria: [],
    execution_status: status,
  };
}

describe('ScopeSummaryStats', () => {
  describe('progress bar', () => {
    it('renders progress bar with correct percentage', () => {
      const steps = [
        createStep('a', 'done'),
        createStep('b', 'done'),
        createStep('c', 'pending'),
        createStep('d', 'pending'),
      ];
      render(<ScopeSummaryStats steps={steps} />);

      // 2 out of 4 = 50%
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('renders 0% for all pending steps', () => {
      const steps = [createStep('a', 'pending'), createStep('b', 'pending')];
      render(<ScopeSummaryStats steps={steps} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('renders 100% for all completed steps', () => {
      const steps = [createStep('a', 'done'), createStep('b', 'completed')];
      render(<ScopeSummaryStats steps={steps} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('stat badges in list view', () => {
    it('shows completed badge when there are completed steps', () => {
      const steps = [createStep('a', 'done'), createStep('b', 'pending')];
      render(<ScopeSummaryStats steps={steps} />);

      const badge = screen.getByText('1');
      expect(badge).toBeInTheDocument();
      // Badge should have completed styling (green background)
      expect(badge.closest('.stat-badge--completed')).toBeInTheDocument();
    });

    it('shows in_progress badge when there are running steps', () => {
      const steps = [createStep('a', 'running'), createStep('b', 'in_progress')];
      render(<ScopeSummaryStats steps={steps} />);

      const badge = screen.getByText('2');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('.stat-badge--in_progress')).toBeInTheDocument();
    });

    it('shows blocked badge for blocked and failed steps', () => {
      const steps = [createStep('a', 'blocked'), createStep('b', 'failed')];
      render(<ScopeSummaryStats steps={steps} />);

      const badge = screen.getByText('2');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('.stat-badge--blocked')).toBeInTheDocument();
    });

    it('hides badges when count is 0', () => {
      const steps = [createStep('a', 'pending'), createStep('b', 'pending')];
      render(<ScopeSummaryStats steps={steps} />);

      // Should not have any stat badges (only pending, which doesn't get a badge)
      expect(screen.queryByText('0')).not.toBeInTheDocument();
      // There should be no completed or in-progress badges since all are pending
      expect(document.querySelector('.stat-badge--completed')).not.toBeInTheDocument();
    });
  });

  describe('compact mode (swimlane)', () => {
    it('shows fraction text instead of percentage', () => {
      const steps = [
        createStep('a', 'done'),
        createStep('b', 'done'),
        createStep('c', 'pending'),
      ];
      render(<ScopeSummaryStats steps={steps} compact />);

      expect(screen.getByText('2/3 complete')).toBeInTheDocument();
    });

    it('does not show stat badges in compact mode', () => {
      const steps = [createStep('a', 'done'), createStep('b', 'running')];
      render(<ScopeSummaryStats steps={steps} compact />);

      // Should only have fraction text, not individual badges
      expect(document.querySelector('.stat-badge')).not.toBeInTheDocument();
    });

    it('handles 0 completed correctly', () => {
      const steps = [createStep('a', 'pending'), createStep('b', 'pending')];
      render(<ScopeSummaryStats steps={steps} compact />);

      expect(screen.getByText('0/2 complete')).toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('handles empty steps array without errors', () => {
      render(<ScopeSummaryStats steps={[]} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('handles empty steps in compact mode', () => {
      render(<ScopeSummaryStats steps={[]} compact />);

      expect(screen.getByText('0/0 complete')).toBeInTheDocument();
    });
  });

  describe('status mapping', () => {
    it('treats "done" and "completed" as completed', () => {
      const steps = [createStep('a', 'done'), createStep('b', 'completed')];
      render(<ScopeSummaryStats steps={steps} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('treats "running" and "in_progress" as in progress', () => {
      const steps = [createStep('a', 'running'), createStep('b', 'in_progress')];
      render(<ScopeSummaryStats steps={steps} />);

      // Should show in_progress badge with count 2
      const badge = screen.getByText('2');
      expect(badge.closest('.stat-badge--in_progress')).toBeInTheDocument();
    });

    it('treats steps without execution_status as pending', () => {
      const steps = [{ ...createStep('a'), execution_status: undefined }];
      render(<ScopeSummaryStats steps={steps} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });
});
