import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PlansToolbar } from '../PlansToolbar';
import type { PlansFilter } from '@/hooks/usePlansFilter';
import type { Initiative } from '@/types/initiative';

// Mock the useInitiatives hook
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
          viewMode="table"
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
          viewMode="table"
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
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const title = screen.getByText('Plans');
      expect(title.tagName).toBe('H1');
    });
  });

  describe('New Plan button', () => {
    it('renders "New Plan" button', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
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
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const button = screen.getByRole('link', { name: /new plan/i });
      expect(button).toHaveAttribute('href', '/plans/new');
    });
  });

  describe('initiative select', () => {
    it('renders initiative select dropdown', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      // The Select component renders a button/trigger with aria-label
      expect(screen.getByRole('combobox', { name: /filter by initiative/i })).toBeInTheDocument();
    });

    it('shows "All initiatives" by default', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      expect(screen.getByText('All initiatives')).toBeInTheDocument();
    });

    // Note: Radix Select has issues with JSDOM's hasPointerCapture
    // Skip interaction test - the component works correctly in the browser
  });

  describe('status filter', () => {
    it('renders status filter toggle group', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
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
          viewMode="table"
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
          viewMode="table"
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
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const statusGroup = screen.getByRole('group', { name: /filter by status/i });
      expect(statusGroup).toBeInTheDocument();
    });
  });

  describe('search input', () => {
    it('renders search input', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      expect(screen.getByPlaceholderText('Search plans...')).toBeInTheDocument();
    });

    it('shows current search value', () => {
      const filterWithSearch: PlansFilter = {
        ...mockFilter,
        search: 'test query',
      };

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={filterWithSearch}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
    });

    it('calls onFilterChange when search input changes', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search plans...');
      await user.type(searchInput, 'hello');

      // Each keystroke calls onFilterChange
      expect(mockOnFilterChange).toHaveBeenCalledWith({ search: 'h' });
    });

    it('shows clear button when search has value', () => {
      const filterWithSearch: PlansFilter = {
        ...mockFilter,
        search: 'test',
      };

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={filterWithSearch}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
    });

    it('clears search when clear button is clicked', async () => {
      const user = userEvent.setup();
      const filterWithSearch: PlansFilter = {
        ...mockFilter,
        search: 'test',
      };

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={filterWithSearch}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      await user.click(screen.getByRole('button', { name: /clear search/i }));

      expect(mockOnFilterChange).toHaveBeenCalledWith({ search: '' });
    });
  });

  describe('view mode toggle', () => {
    it('renders view mode toggle with three options', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      // Use exact name match to avoid "Table view" also matching "Sectioned table view"
      expect(screen.getByRole('radio', { name: 'Table view' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Sectioned table view' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Card view' })).toBeInTheDocument();
    });

    it('highlights selected view mode - table', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const tableViewButton = screen.getByRole('radio', { name: 'Table view' });
      expect(tableViewButton).toHaveAttribute('data-state', 'on');
    });

    it('highlights selected view mode - sectioned', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="sectioned"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const sectionedViewButton = screen.getByRole('radio', { name: /sectioned table view/i });
      expect(sectionedViewButton).toHaveAttribute('data-state', 'on');
    });

    it('highlights selected view mode - cards', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="cards"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const cardsViewButton = screen.getByRole('radio', { name: /card view/i });
      expect(cardsViewButton).toHaveAttribute('data-state', 'on');
    });

    it('calls onViewModeChange when view mode is changed', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const sectionedViewButton = screen.getByRole('radio', { name: /sectioned table view/i });
      await user.click(sectionedViewButton);

      expect(mockOnViewModeChange).toHaveBeenCalledWith('sectioned');
    });

    it('provides aria-label for view mode toggle', () => {
      renderWithRouter(
        <PlansToolbar
          title="Plans"
          filter={mockFilter}
          onFilterChange={mockOnFilterChange}
          viewMode="table"
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
          viewMode="table"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const toolbar = container.firstChild as HTMLElement;
      expect(toolbar).toHaveClass('border-b', 'border-border-subtle');
    });
  });
});
