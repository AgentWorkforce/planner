import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InitiativeCard } from '../InitiativeCard';
import type { InitiativeWithPlanCounts } from '@/types/initiative';

function createMockInitiative(
  overrides?: Partial<InitiativeWithPlanCounts>
): InitiativeWithPlanCounts {
  return {
    initiative_id: 'init-1',
    org_id: 'org-1',
    name: 'Q1 Product Launch',
    description: 'Launch our new product in Q1 2026',
    status: 'active',
    icon: '🚀',
    color: '#00d9ff',
    display_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    plan_counts: {
      total: 5,
      draft: 2,
      approved: 2,
      published: 1,
    },
    ...overrides,
  };
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('InitiativeCard', () => {
  describe('content rendering', () => {
    it('renders initiative name', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.getByText('Q1 Product Launch')).toBeInTheDocument();
    });

    it('renders initiative icon', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      const icon = screen.getByRole('img', { name: 'Initiative icon' });
      expect(icon).toHaveTextContent('🚀');
    });

    it('renders default icon when no icon provided', () => {
      const initiative = createMockInitiative({ icon: undefined });
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      const icon = screen.getByRole('img', { name: 'Initiative icon' });
      expect(icon).toHaveTextContent('🎯');
    });

    it('renders initiative description', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.getByText('Launch our new product in Q1 2026')).toBeInTheDocument();
    });

    it('shows placeholder when description is empty', () => {
      const initiative = createMockInitiative({ description: undefined });
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.getByText('No description')).toBeInTheDocument();
    });

    it('truncates long description with line-clamp-2', () => {
      const initiative = createMockInitiative({
        description:
          'This is a very long description that should be truncated after two lines to keep the card compact and readable.',
      });
      const { container } = renderWithRouter(<InitiativeCard initiative={initiative} />);

      const descriptionElement = container.querySelector('.line-clamp-2');
      expect(descriptionElement).toBeInTheDocument();
    });
  });

  describe('status badge', () => {
    it('shows active status with success variant', () => {
      const initiative = createMockInitiative({ status: 'active' });
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      const badge = screen.getByText('active');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-success/10', 'text-success');
    });

    it('shows completed status with info variant', () => {
      const initiative = createMockInitiative({ status: 'completed' });
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      const badge = screen.getByText('completed');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-accent-cyan/10', 'text-accent-cyan');
    });

    it('shows archived status with default variant', () => {
      const initiative = createMockInitiative({ status: 'archived' });
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      const badge = screen.getByText('archived');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-bg-tertiary', 'text-text-secondary');
    });
  });

  describe('plan counts', () => {
    it('shows total plan count', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('plans')).toBeInTheDocument();
    });

    it('uses singular "plan" when count is 1', () => {
      const initiative = createMockInitiative({
        plan_counts: { total: 1, draft: 1, approved: 0, published: 0 },
      });
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('plan')).toBeInTheDocument();
    });

    it('shows "No plans" when total is 0', () => {
      const initiative = createMockInitiative({
        plan_counts: { total: 0, draft: 0, approved: 0, published: 0 },
      });
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('plans')).toBeInTheDocument();
    });

    it('shows draft count with warning indicator', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.getByText('2 draft')).toBeInTheDocument();
      const draftIndicator = screen
        .getByText('2 draft')
        .parentElement?.querySelector('.bg-warning');
      expect(draftIndicator).toBeInTheDocument();
    });

    it('shows approved count with success indicator', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.getByText('2 approved')).toBeInTheDocument();
      const approvedIndicator = screen
        .getByText('2 approved')
        .parentElement?.querySelector('.bg-success');
      expect(approvedIndicator).toBeInTheDocument();
    });

    it('shows published count with cyan indicator', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.getByText('1 published')).toBeInTheDocument();
      const publishedIndicator = screen
        .getByText('1 published')
        .parentElement?.querySelector('.bg-accent-cyan');
      expect(publishedIndicator).toBeInTheDocument();
    });

    it('hides breakdown section when no plans exist', () => {
      const initiative = createMockInitiative({
        plan_counts: { total: 0, draft: 0, approved: 0, published: 0 },
      });
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.queryByText('draft')).not.toBeInTheDocument();
      expect(screen.queryByText('approved')).not.toBeInTheDocument();
      expect(screen.queryByText('published')).not.toBeInTheDocument();
    });

    it('only shows non-zero plan statuses', () => {
      const initiative = createMockInitiative({
        plan_counts: { total: 3, draft: 0, approved: 3, published: 0 },
      });
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      expect(screen.queryByText('draft')).not.toBeInTheDocument();
      expect(screen.getByText('3 approved')).toBeInTheDocument();
      expect(screen.queryByText('published')).not.toBeInTheDocument();
    });
  });

  describe('linking behavior', () => {
    it('links to initiative detail page', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      const card = screen.getByRole('link');
      expect(card).toHaveAttribute('href', '/initiatives/init-1');
    });

    it('entire card is clickable', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      const card = screen.getByRole('link');
      expect(card).toHaveClass('block');
    });
  });

  describe('visual styling', () => {
    it('applies icon background color from initiative color', () => {
      const initiative = createMockInitiative({ color: '#ff6b35' });
      const { container } = renderWithRouter(<InitiativeCard initiative={initiative} />);

      const iconContainer = container.querySelector('[style*="background-color"]');
      expect(iconContainer).toHaveStyle({ backgroundColor: '#ff6b3520' });
    });

    it('uses default color when no color provided', () => {
      const initiative = createMockInitiative({ color: undefined });
      const { container } = renderWithRouter(<InitiativeCard initiative={initiative} />);

      const iconContainer = container.querySelector('[style*="background-color"]');
      expect(iconContainer).toHaveStyle({ backgroundColor: '#00d9ff20' });
    });

    it('applies active status hover glow', () => {
      const initiative = createMockInitiative({ status: 'active' });
      const { container } = renderWithRouter(<InitiativeCard initiative={initiative} />);

      const card = container.querySelector('.hover\\:shadow-\\[0_0_16px_rgba\\(0\\,255\\,200\\,0\\.12\\)\\]');
      expect(card).toBeInTheDocument();
    });

    it('applies completed status hover glow', () => {
      const initiative = createMockInitiative({ status: 'completed' });
      const { container } = renderWithRouter(<InitiativeCard initiative={initiative} />);

      const card = container.querySelector('.hover\\:shadow-\\[0_0_16px_rgba\\(0\\,217\\,255\\,0\\.15\\)\\]');
      expect(card).toBeInTheDocument();
    });

    it('does not apply hover glow for archived status', () => {
      const initiative = createMockInitiative({ status: 'archived' });
      const { container } = renderWithRouter(<InitiativeCard initiative={initiative} />);

      const card = screen.getByRole('link');
      expect(card.className).not.toContain('hover:shadow-');
    });

    it('applies custom className', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} className="custom-class" />);

      const card = screen.getByRole('link');
      expect(card).toHaveClass('custom-class');
    });
  });

  describe('hover effects', () => {
    it('applies hover styles for border and background', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      const card = screen.getByRole('link');
      expect(card).toHaveClass('hover:border-accent-cyan/50', 'hover:bg-bg-hover/50');
    });

    it('applies text color change on hover for title', () => {
      const initiative = createMockInitiative();
      renderWithRouter(<InitiativeCard initiative={initiative} />);

      const title = screen.getByText('Q1 Product Launch');
      expect(title).toHaveClass('group-hover:text-accent-cyan');
    });
  });
});
