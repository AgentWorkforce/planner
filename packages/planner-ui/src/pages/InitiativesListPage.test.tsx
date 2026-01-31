import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InitiativesListPage } from './InitiativesListPage';
import type { Initiative } from '@/types/initiative';

// Mock hooks
vi.mock('@/hooks/useInitiatives', () => ({
  useInitiatives: vi.fn(),
}));

// Mock API functions
vi.mock('@/api/initiatives', () => ({
  createInitiative: vi.fn(),
  updateInitiative: vi.fn(),
  reorderInitiatives: vi.fn(),
}));

// Mock components
vi.mock('@/components/initiatives/InitiativeCard', () => ({
  InitiativeCard: ({ initiative }: { initiative: any }) => (
    <div data-testid={`initiative-card-${initiative.initiative_id}`}>
      {initiative.name}
    </div>
  ),
}));

vi.mock('@/components/initiatives/InitiativeCardSkeleton', () => ({
  InitiativeCardSkeleton: () => <div data-testid="initiative-skeleton">Loading...</div>,
}));

vi.mock('@/components/initiatives/InitiativeModal', () => ({
  InitiativeModal: ({ open, onOpenChange, onSave }: any) =>
    open ? (
      <div data-testid="initiative-modal">
        <button onClick={() => onSave({ name: 'Test Initiative' })}>Save</button>
        <button onClick={() => onOpenChange(false)}>Cancel</button>
      </div>
    ) : null,
}));

import { useInitiatives } from '@/hooks/useInitiatives';
import { createInitiative, reorderInitiatives } from '@/api/initiatives';

function createMockInitiative(overrides?: Partial<Initiative>): Initiative {
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
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <InitiativesListPage />
    </MemoryRouter>
  );
}

describe('InitiativesListPage', () => {
  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('header rendering', () => {
    it('renders page title "Initiatives"', async () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByText('Initiatives')).toBeInTheDocument();
      expect(
        screen.getByText('Organize and track strategic goals with grouped plans')
      ).toBeInTheDocument();
    });

    it('renders New Initiative button', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByRole('button', { name: /new initiative/i })).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading skeleton while fetching', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      // Should show multiple skeletons (6 in the actual implementation)
      const skeletons = screen.getAllByTestId('initiative-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not show filter tabs while loading', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      // Filter tabs should not be visible
      expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when fetch fails', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: 'Network error',
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('does not render initiatives when error occurs', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: 'Network error',
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.queryByTestId('initiative-card-init-1')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no initiatives exist', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByText('No initiatives yet')).toBeInTheDocument();
      expect(
        screen.getByText('Create your first initiative to organize plans around strategic goals.')
      ).toBeInTheDocument();
    });

    it('shows CTA button in empty state', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByRole('button', { name: /create your first initiative/i })).toBeInTheDocument();
    });

    it('does not show filter tabs in empty state', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
    });
  });

  describe('initiatives list rendering', () => {
    it('renders initiative cards when data loaded', () => {
      const initiatives = [
        createMockInitiative({ initiative_id: 'init-1', name: 'Initiative 1' }),
        createMockInitiative({ initiative_id: 'init-2', name: 'Initiative 2' }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByTestId('initiative-card-init-1')).toBeInTheDocument();
      expect(screen.getByTestId('initiative-card-init-2')).toBeInTheDocument();
    });

    it('shows filter tabs when initiatives exist', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Archived' })).toBeInTheDocument();
    });
  });

  describe('status filter', () => {
    it('All filter is active by default', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      const allButton = screen.getByRole('button', { name: 'All' });
      expect(allButton).toHaveClass('bg-bg-elevated', 'text-text-primary');
    });

    it('filters initiatives by active status', async () => {
      const user = userEvent.setup();
      const initiatives = [
        createMockInitiative({ initiative_id: 'init-1', status: 'active' }),
        createMockInitiative({ initiative_id: 'init-2', status: 'completed' }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      // Click Active filter
      await user.click(screen.getByRole('button', { name: 'Active' }));

      // Only active initiative should be visible
      expect(screen.getByTestId('initiative-card-init-1')).toBeInTheDocument();
      expect(screen.queryByTestId('initiative-card-init-2')).not.toBeInTheDocument();
    });

    it('filters initiatives by completed status', async () => {
      const user = userEvent.setup();
      const initiatives = [
        createMockInitiative({ initiative_id: 'init-1', status: 'active' }),
        createMockInitiative({ initiative_id: 'init-2', status: 'completed' }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      await user.click(screen.getByRole('button', { name: 'Completed' }));

      expect(screen.queryByTestId('initiative-card-init-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('initiative-card-init-2')).toBeInTheDocument();
    });

    it('filters initiatives by archived status', async () => {
      const user = userEvent.setup();
      const initiatives = [
        createMockInitiative({ initiative_id: 'init-1', status: 'active' }),
        createMockInitiative({ initiative_id: 'init-2', status: 'archived' }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      await user.click(screen.getByRole('button', { name: 'Archived' }));

      expect(screen.queryByTestId('initiative-card-init-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('initiative-card-init-2')).toBeInTheDocument();
    });

    it('shows empty filtered state when no initiatives match filter', async () => {
      const user = userEvent.setup();
      const initiatives = [createMockInitiative({ status: 'active' })];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      await user.click(screen.getByRole('button', { name: 'Completed' }));

      expect(screen.getByText(/no completed initiatives/i)).toBeInTheDocument();
      expect(screen.getByText(/try selecting a different status filter/i)).toBeInTheDocument();
    });

    it('switching filters updates active state', async () => {
      const user = userEvent.setup();
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      const activeButton = screen.getByRole('button', { name: 'Active' });
      await user.click(activeButton);

      expect(activeButton).toHaveClass('bg-bg-elevated', 'text-text-primary');

      const allButton = screen.getByRole('button', { name: 'All' });
      expect(allButton).not.toHaveClass('bg-bg-elevated');
    });
  });

  describe('new initiative modal', () => {
    it('opens modal when New Initiative button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.queryByTestId('initiative-modal')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /new initiative/i }));

      expect(screen.getByTestId('initiative-modal')).toBeInTheDocument();
    });

    it('opens modal from empty state CTA', async () => {
      const user = userEvent.setup();
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      await user.click(screen.getByRole('button', { name: /create your first initiative/i }));

      expect(screen.getByTestId('initiative-modal')).toBeInTheDocument();
    });

    it('calls createInitiative API when modal saves', async () => {
      const user = userEvent.setup();
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });
      vi.mocked(createInitiative).mockResolvedValue(createMockInitiative());

      renderPage();

      await user.click(screen.getByRole('button', { name: /new initiative/i }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(createInitiative).toHaveBeenCalledWith({ name: 'Test Initiative' });
      });
    });

    it('refreshes initiatives list after creating', async () => {
      const user = userEvent.setup();
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });
      vi.mocked(createInitiative).mockResolvedValue(createMockInitiative());

      renderPage();

      await user.click(screen.getByRole('button', { name: /new initiative/i }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it('closes modal when cancel clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      await user.click(screen.getByRole('button', { name: /new initiative/i }));
      expect(screen.getByTestId('initiative-modal')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByTestId('initiative-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('drag-drop reorder', () => {
    it('renders initiatives in sortable context', () => {
      const initiatives = [
        createMockInitiative({ initiative_id: 'init-1' }),
        createMockInitiative({ initiative_id: 'init-2' }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      // Both initiatives should be rendered (DnD context wraps them)
      expect(screen.getByTestId('initiative-card-init-1')).toBeInTheDocument();
      expect(screen.getByTestId('initiative-card-init-2')).toBeInTheDocument();
    });

    // Note: Full drag-drop interaction testing requires more complex setup with @dnd-kit
    // These tests verify the structure is in place. Full DnD testing would need additional mocking.
  });
});
