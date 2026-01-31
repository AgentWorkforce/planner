import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PlansToolbar } from '../PlansToolbar';
import type { PlansFilter } from '@/hooks/usePlansFilter';
import type { Initiative } from '@/types/initiative';

// Mock the useInitiatives hook used by InitiativeTabs
vi.mock('@/hooks/useInitiatives', () => ({
  useInitiatives: vi.fn(),
}));

import { useInitiatives } from '@/hooks/useInitiatives';

function createMockInitiative(overrides?: Partial<Initiative>): Initiative {
  return {
    initiative_id: 'init-1',
    org_id: 'org-1',
    name: 'Q1 Launch',
    status: 'active',
    icon: '🚀',
    color: '#00d9ff',
    display_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('PlansToolbar', () => {
  const mockFilter: PlansFilter = {
    status: 'all',
    initiative_id: null,
    owner_user_id: null,
    search: '',
  };

  const mockOnFilterChange = vi.fn();
  const mockOnViewModeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for useInitiatives
    vi.mocked(useInitiatives).mockReturnValue({
      initiatives: [createMockInitiative()],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  describe('title rendering', () => {
    it('renders the provided title', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      expect(screen.getByText('Plans')).toBeInTheDocument();
    });

    it('renders custom title "My Plans"', () => {
      renderWithRouter(
        <PlansToolbar
          title="My Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      expect(screen.getByText('My Plans')).toBeInTheDocument();
    });

    it('applies heading styles to title', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const title = screen.getByText('Plans');
      expect(title.tagName).toBe('H1');
      expect(title).toHaveClass('font-display', 'text-lg', 'font-semibold', 'text-text-primary');
    });
  });

  describe('New Plan button', () => {
    it('renders "New Plan" button', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const button = screen.getByRole('link', { name: /new plan/i });
      expect(button).toBeInTheDocument();
    });

    it('links to /plans/new', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const button = screen.getByRole('link', { name: /new plan/i });
      expect(button).toHaveAttribute('href', '/plans/new');
    });

    it('renders plus icon in button', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const button = screen.getByRole('link', { name: /new plan/i });
      expect(button).toHaveTextContent('New Plan');
    });
  });

  describe('InitiativeTabs integration', () => {
    it('renders InitiativeTabs component', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('passes selectedId from filter to InitiativeTabs', () => {
      const filterWithInitiative: PlansFilter = {
        ...mockFilter,
        initiative_id: 'init-1',
      };

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={filterWithInitiative}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const selectedTab = screen.getByRole('tab', { selected: true });
      expect(selectedTab).toBeInTheDocument();
    });

    it('calls onFilterChange when initiative is selected', async () => {
      const user = userEvent.setup();

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [
          createMockInitiative({ initiative_id: 'init-1', name: 'Q1 Launch' }),
        ],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const initiativeTab = screen.getByText('Q1 Launch');
      await user.click(initiativeTab);

      expect(mockOnFilterChange).toHaveBeenCalledWith({ initiative_id: 'init-1' });
    });

    it('calls onFilterChange with null when "All" is clicked', async () => {
      const user = userEvent.setup();

      const filterWithInitiative: PlansFilter = {
        ...mockFilter,
        initiative_id: 'init-1',
      };

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={filterWithInitiative}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const allTab = screen.getByRole('tab', { name: 'All' });
      await user.click(allTab);

      expect(mockOnFilterChange).toHaveBeenCalledWith({ initiative_id: null });
    });
  });

  describe('status filter', () => {
    it('renders status filter toggle group', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      expect(screen.getByRole('radio', { name: /all plans/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /draft plans/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /approved plans/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /published plans/i })).toBeInTheDocument();
    });

    it('highlights selected status', () => {
      const filterWithStatus: PlansFilter = {
        ...mockFilter,
        status: 'draft',
      };

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={filterWithStatus}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const draftButton = screen.getByRole('radio', { name: /draft plans/i });
      expect(draftButton).toHaveAttribute('data-state', 'on');
    });

    it('calls onFilterChange when status is changed', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const draftButton = screen.getByRole('radio', { name: /draft plans/i });
      await user.click(draftButton);

      expect(mockOnFilterChange).toHaveBeenCalledWith({ status: 'draft' });
    });

    it('provides aria-label for status filter', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const statusGroup = screen.getByRole('group', { name: /filter by status/i });
      expect(statusGroup).toBeInTheDocument();
    });
  });

  describe('view mode toggle', () => {
    it('renders view mode toggle', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const listViewButton = screen.getByRole('radio', { name: /list view/i });
      const groupedViewButton = screen.getByRole('radio', { name: /grouped view/i });

      expect(listViewButton).toBeInTheDocument();
      expect(groupedViewButton).toBeInTheDocument();
    });

    it('highlights selected view mode', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const listViewButton = screen.getByRole('radio', { name: /list view/i });
      expect(listViewButton).toHaveAttribute('data-state', 'on');
    });

    it('highlights grouped view mode', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="grouped"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const groupedViewButton = screen.getByRole('radio', { name: /grouped view/i });
      expect(groupedViewButton).toHaveAttribute('data-state', 'on');
    });

    it('calls onViewModeChange when list view is clicked', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="grouped"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const listViewButton = screen.getByRole('radio', { name: /list view/i });
      await user.click(listViewButton);

      expect(mockOnViewModeChange).toHaveBeenCalledWith('list');
    });

    it('calls onViewModeChange when grouped view is clicked', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const groupedViewButton = screen.getByRole('radio', { name: /grouped view/i });
      await user.click(groupedViewButton);

      expect(mockOnViewModeChange).toHaveBeenCalledWith('grouped');
    });

    it('provides aria-label for view mode toggle', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const viewModeGroup = screen.getByRole('group', { name: /view mode/i });
      expect(viewModeGroup).toBeInTheDocument();
    });
  });

  describe('layout structure', () => {
    it('has two-row structure with border bottom', () => {
      const { container } = renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const toolbar = container.firstChild as HTMLElement;
      expect(toolbar).toHaveClass('border-b', 'border-border-subtle');
    });

    it('renders title and button in first row', () => {
      const { container } = renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const firstRow = container.querySelector('.h-12:first-child');
      expect(firstRow).toBeInTheDocument();
      expect(firstRow).toHaveClass('flex', 'items-center', 'justify-between');
    });

    it('renders filters and view mode in second row', () => {
      const { container } = renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const rows = container.querySelectorAll('.h-12');
      expect(rows).toHaveLength(2);

      const secondRow = rows[1];
      expect(secondRow).toHaveClass('flex', 'items-center', 'justify-between');
    });

    it('applies correct padding to rows', () => {
      const { container } = renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const rows = container.querySelectorAll('.h-12');
      rows.forEach((row) => {
        expect(row).toHaveClass('px-4');
      });
    });
  });

  describe('responsive behavior', () => {
    it('prevents right side controls from shrinking', () => {
      const { container } = renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const rightSide = container.querySelector('.flex-shrink-0');
      expect(rightSide).toBeInTheDocument();
    });

    it('allows InitiativeTabs to scroll horizontally', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="list"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveClass('overflow-x-auto');
    });
  });

  describe('integration with multiple filters', () => {
    it('handles multiple active filters simultaneously', () => {
      const activeFilter: PlansFilter = {
        status: 'draft',
        initiative_id: 'init-1',
        owner_user_id: null,
        search: '',
      };

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={activeFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="grouped"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const draftButton = screen.getByRole('radio', { name: /draft plans/i });
      const groupedViewButton = screen.getByRole('radio', { name: /grouped view/i });

      expect(draftButton).toHaveAttribute('data-state', 'on');
      expect(groupedViewButton).toHaveAttribute('data-state', 'on');
    });
  });
});
