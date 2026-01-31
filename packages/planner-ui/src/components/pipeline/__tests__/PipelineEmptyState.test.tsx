import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PipelineEmptyState } from '../PipelineEmptyState';

describe('PipelineEmptyState', () => {
  describe('default empty state (no initiative filter)', () => {
    it('renders title for no plans', () => {
      render(<PipelineEmptyState />);

      expect(screen.getByText('No plans in pipeline')).toBeInTheDocument();
    });

    it('renders description for no plans', () => {
      render(<PipelineEmptyState />);

      expect(
        screen.getByText('Create your first plan to see it flow through the pipeline')
      ).toBeInTheDocument();
    });

    it('applies correct title styling', () => {
      render(<PipelineEmptyState />);

      const title = screen.getByText('No plans in pipeline');
      expect(title).toHaveClass('text-lg', 'font-medium', 'text-text-primary', 'mb-2');
    });

    it('applies correct description styling', () => {
      render(<PipelineEmptyState />);

      const description = screen.getByText(
        'Create your first plan to see it flow through the pipeline'
      );
      expect(description).toHaveClass('text-sm', 'text-text-secondary', 'mb-6');
    });
  });

  describe('initiative-filtered empty state', () => {
    it('renders title for no plans in initiative', () => {
      render(<PipelineEmptyState initiativeId="init-123" />);

      expect(screen.getByText('No plans for this initiative')).toBeInTheDocument();
    });

    it('renders description for no plans in initiative', () => {
      render(<PipelineEmptyState initiativeId="init-123" />);

      expect(
        screen.getByText('Create a plan to get started with this initiative')
      ).toBeInTheDocument();
    });
  });

  describe('icon rendering', () => {
    it('renders pipeline icon', () => {
      const { container } = render(<PipelineEmptyState />);

      const iconContainer = container.querySelector('.w-12.h-12');
      expect(iconContainer).toBeInTheDocument();

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('applies muted opacity to icon', () => {
      const { container } = render(<PipelineEmptyState />);

      const icon = container.querySelector('.text-text-muted.opacity-50');
      expect(icon).toBeInTheDocument();
    });

    it('renders icon at xl size', () => {
      const { container } = render(<PipelineEmptyState />);

      const icon = container.querySelector('.w-12.h-12');
      expect(icon).toBeInTheDocument();
    });

    it('applies margin below icon', () => {
      const { container } = render(<PipelineEmptyState />);

      const iconContainer = container.querySelector('.mb-6');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Create Plan button', () => {
    it('renders button when onCreatePlan provided', () => {
      const mockOnCreatePlan = vi.fn();
      render(<PipelineEmptyState onCreatePlan={mockOnCreatePlan} />);

      expect(screen.getByRole('button', { name: 'Create Plan' })).toBeInTheDocument();
    });

    it('does not render button when onCreatePlan not provided', () => {
      render(<PipelineEmptyState />);

      expect(screen.queryByRole('button', { name: 'Create Plan' })).not.toBeInTheDocument();
    });

    it('calls onCreatePlan when button clicked', async () => {
      const user = userEvent.setup();
      const mockOnCreatePlan = vi.fn();

      render(<PipelineEmptyState onCreatePlan={mockOnCreatePlan} />);

      const button = screen.getByRole('button', { name: 'Create Plan' });
      await user.click(button);

      expect(mockOnCreatePlan).toHaveBeenCalledTimes(1);
    });

    it('renders button with primary variant', () => {
      const mockOnCreatePlan = vi.fn();
      render(<PipelineEmptyState onCreatePlan={mockOnCreatePlan} />);

      const button = screen.getByRole('button', { name: 'Create Plan' });
      expect(button).toHaveClass('bg-accent-cyan');
    });
  });

  describe('layout and centering', () => {
    it('applies centered flex column layout', () => {
      const { container } = render(<PipelineEmptyState />);

      const layout = container.querySelector('.flex.flex-col.items-center.justify-center');
      expect(layout).toBeInTheDocument();
    });

    it('applies vertical padding', () => {
      const { container } = render(<PipelineEmptyState />);

      const layout = container.querySelector('.py-16');
      expect(layout).toBeInTheDocument();
    });

    it('applies text-center alignment', () => {
      const { container } = render(<PipelineEmptyState />);

      const layout = container.querySelector('.text-center');
      expect(layout).toBeInTheDocument();
    });

    it('applies max-width constraint', () => {
      const { container } = render(<PipelineEmptyState />);

      const layout = container.querySelector('.max-w-sm');
      expect(layout).toBeInTheDocument();
    });

    it('centers content horizontally with mx-auto', () => {
      const { container } = render(<PipelineEmptyState />);

      const layout = container.querySelector('.mx-auto');
      expect(layout).toBeInTheDocument();
    });
  });

  describe('content hierarchy', () => {
    it('renders icon, then title, then description, then button in order', () => {
      const mockOnCreatePlan = vi.fn();
      const { container } = render(<PipelineEmptyState onCreatePlan={mockOnCreatePlan} />);

      // Get direct children of the main container div
      const mainContainer = container.querySelector('.flex.flex-col.items-center');
      const directChildren = Array.from(mainContainer?.children || []);

      const elements = directChildren.map(el => {
        if (el.querySelector('svg')) return 'icon';
        if (el.tagName === 'H3') return 'title';
        if (el.tagName === 'P') return 'description';
        if (el.tagName === 'BUTTON') return 'button';
        return 'other';
      });

      const relevantElements = elements.filter(e => e !== 'other');
      expect(relevantElements).toEqual(['icon', 'title', 'description', 'button']);
    });
  });

  describe('different initiative scenarios', () => {
    it('handles initiativeId as undefined', () => {
      render(<PipelineEmptyState initiativeId={undefined} />);

      expect(screen.getByText('No plans in pipeline')).toBeInTheDocument();
    });

    it('handles initiativeId as empty string', () => {
      render(<PipelineEmptyState initiativeId="" />);

      // Empty string is falsy in JavaScript, so it shows the default message
      expect(screen.getByText('No plans in pipeline')).toBeInTheDocument();
    });

    it('handles initiativeId as non-empty string', () => {
      render(<PipelineEmptyState initiativeId="init-123" />);

      expect(screen.getByText('No plans for this initiative')).toBeInTheDocument();
    });
  });

  describe('button and initiative interaction', () => {
    it('renders button with initiative context', () => {
      const mockOnCreatePlan = vi.fn();
      render(<PipelineEmptyState initiativeId="init-123" onCreatePlan={mockOnCreatePlan} />);

      expect(screen.getByRole('button', { name: 'Create Plan' })).toBeInTheDocument();
    });

    it('calls onCreatePlan with initiative context', async () => {
      const user = userEvent.setup();
      const mockOnCreatePlan = vi.fn();

      render(<PipelineEmptyState initiativeId="init-123" onCreatePlan={mockOnCreatePlan} />);

      const button = screen.getByRole('button', { name: 'Create Plan' });
      await user.click(button);

      expect(mockOnCreatePlan).toHaveBeenCalledTimes(1);
    });
  });
});
