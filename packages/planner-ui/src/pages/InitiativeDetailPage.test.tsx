import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InitiativeDetailPage } from './InitiativeDetailPage';
import type { Initiative, PlanSummary } from '@/types';

// Mock useParams
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock hooks
vi.mock('@/hooks/useInitiative', () => ({
  useInitiative: vi.fn(),
}));

vi.mock('@/hooks/useInitiatives', () => ({
  invalidateInitiatives: vi.fn(),
}));

// Mock API functions
vi.mock('@/api/initiatives', () => ({
  updateInitiative: vi.fn(),
  deleteInitiative: vi.fn(),
}));

// Mock components
vi.mock('@/components/initiatives/InitiativeModal', () => ({
  InitiativeModal: ({ open, onOpenChange, initiative, onSave }: any) =>
    open ? (
      <div data-testid="initiative-modal">
        <p>Editing: {initiative?.name}</p>
        <button onClick={() => onSave({ name: 'Updated Initiative' })}>Save</button>
        <button onClick={() => onOpenChange(false)}>Cancel</button>
      </div>
    ) : null,
}));

vi.mock('@/components/PlanCard', () => ({
  PlanCard: ({ plan }: { plan: any }) => (
    <div data-testid={`plan-card-${plan.plan_id}`}>{plan.summary.goal}</div>
  ),
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: any) => <span data-testid="status-badge">{children}</span>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton">Loading...</div>,
}));

import { useInitiative } from '@/hooks/useInitiative';
import { updateInitiative } from '@/api/initiatives';

function createMockInitiative(overrides?: Partial<Initiative>): Initiative {
  return {
    initiative_id: 'init-123',
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

function createMockPlan(overrides?: Partial<PlanSummary>): PlanSummary {
  return {
    plan_id: 'plan-1',
    version: 1,
    status: 'draft',
    summary: {
      goal: 'Test Plan',
      context: 'Test context',
    },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    step_count: 5,
    ...overrides,
  };
}

function renderPage(initiativeId: string = 'init-123') {
  return render(
    <MemoryRouter initialEntries={[`/initiatives/${initiativeId}`]}>
      <Routes>
        <Route path="/initiatives/:id" element={<InitiativeDetailPage />} />
        <Route path="/initiatives" element={<div>Initiatives List</div>} />
        <Route path="/plans/new" element={<div>New Plan</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InitiativeDetailPage', () => {
  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  describe('loading state', () => {
    it('shows loading skeleton while fetching', () => {
      vi.mocked(useInitiative).mockReturnValue({
        initiative: null,
        plans: [],
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not show content while loading', () => {
      vi.mocked(useInitiative).mockReturnValue({
        initiative: null,
        plans: [],
        isLoading: true,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.queryByText('Q1 Product Launch')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when fetch fails', () => {
      vi.mocked(useInitiative).mockReturnValue({
        initiative: null,
        plans: [],
        isLoading: false,
        error: 'Network error',
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByText('Error Loading Initiative')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('shows back button in error state', () => {
      vi.mocked(useInitiative).mockReturnValue({
        initiative: null,
        plans: [],
        isLoading: false,
        error: 'Network error',
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByRole('link', { name: /back to initiatives/i })).toBeInTheDocument();
    });
  });

  describe('404 state', () => {
    it('shows not found message when initiative is null', () => {
      vi.mocked(useInitiative).mockReturnValue({
        initiative: null,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByText('Initiative not found')).toBeInTheDocument();
      expect(
        screen.getByText("The initiative you're looking for doesn't exist or has been deleted.")
      ).toBeInTheDocument();
    });

    it('shows back link in 404 state', () => {
      vi.mocked(useInitiative).mockReturnValue({
        initiative: null,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      const backLink = screen.getByRole('link', { name: /back to initiatives/i });
      expect(backLink).toHaveAttribute('href', '/initiatives');
    });
  });

  describe('header rendering', () => {
    it('renders initiative name', () => {
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByText('Q1 Product Launch')).toBeInTheDocument();
    });

    it('renders initiative icon', () => {
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      const icon = screen.getByRole('img', { name: 'Initiative icon' });
      expect(icon).toHaveTextContent('🚀');
    });

    it('renders default icon when no icon provided', () => {
      const initiative = createMockInitiative({ icon: undefined });
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      const icon = screen.getByRole('img', { name: 'Initiative icon' });
      expect(icon).toHaveTextContent('🎯');
    });

    it('renders initiative status badge', () => {
      const initiative = createMockInitiative({ status: 'active' });
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByTestId('status-badge')).toHaveTextContent('active');
    });

    it('renders initiative description', () => {
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByText('Launch our new product in Q1 2026')).toBeInTheDocument();
    });

    it('does not render description section when description is empty', () => {
      const initiative = createMockInitiative({ description: undefined });
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      // Check that the header still renders but description is not shown
      expect(screen.getByText('Q1 Product Launch')).toBeInTheDocument();
      expect(screen.queryByText('Launch our new product in Q1 2026')).not.toBeInTheDocument();
    });

    it('renders back button to /initiatives', () => {
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      const backLink = screen.getByRole('link', { name: /back to initiatives/i });
      expect(backLink).toHaveAttribute('href', '/initiatives');
    });
  });

  describe('action buttons', () => {
    it('renders Edit button', () => {
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('renders Archive button', () => {
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
    });

    it('opens edit modal when Edit button clicked', async () => {
      const user = userEvent.setup();
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.queryByTestId('initiative-modal')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(screen.getByTestId('initiative-modal')).toBeInTheDocument();
      expect(screen.getByText('Editing: Q1 Product Launch')).toBeInTheDocument();
    });

    it('calls updateInitiative when edit modal saves', async () => {
      const user = userEvent.setup();
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });
      vi.mocked(updateInitiative).mockResolvedValue(
        createMockInitiative({ name: 'Updated Initiative' })
      );

      renderPage();

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(updateInitiative).toHaveBeenCalledWith('init-123', { name: 'Updated Initiative' });
      });
    });

    it('refreshes initiative after updating', async () => {
      const user = userEvent.setup();
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });
      vi.mocked(updateInitiative).mockResolvedValue(createMockInitiative());

      renderPage();

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe('archive functionality', () => {
    it('shows confirmation dialog when Archive clicked', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      await user.click(screen.getByRole('button', { name: /archive/i }));

      expect(confirmSpy).toHaveBeenCalledWith(
        'Archive "Q1 Product Launch"? This will hide it from active views.'
      );

      confirmSpy.mockRestore();
    });

    it('archives initiative when confirmed', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });
      vi.mocked(updateInitiative).mockResolvedValue(
        createMockInitiative({ status: 'archived' })
      );

      renderPage();

      await user.click(screen.getByRole('button', { name: /archive/i }));

      await waitFor(() => {
        expect(updateInitiative).toHaveBeenCalledWith('init-123', { status: 'archived' });
      });

      confirmSpy.mockRestore();
    });

    it('navigates to /initiatives after archiving', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });
      vi.mocked(updateInitiative).mockResolvedValue(
        createMockInitiative({ status: 'archived' })
      );

      renderPage();

      await user.click(screen.getByRole('button', { name: /archive/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/initiatives');
      });

      confirmSpy.mockRestore();
    });

    it('does not archive when cancelled', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      await user.click(screen.getByRole('button', { name: /archive/i }));

      expect(updateInitiative).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('shows Archiving... text while archiving', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });
      // Never resolve to keep loading state
      vi.mocked(updateInitiative).mockImplementation(
        () => new Promise(() => {})
      );

      renderPage();

      await user.click(screen.getByRole('button', { name: /archive/i }));

      await waitFor(() => {
        expect(screen.getByText('Archiving...')).toBeInTheDocument();
      });

      confirmSpy.mockRestore();
    });
  });

  describe('plans section', () => {
    it('shows section header with plan count', () => {
      const initiative = createMockInitiative();
      const plans = [createMockPlan(), createMockPlan({ plan_id: 'plan-2' })];
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByText('Plans (2)')).toBeInTheDocument();
    });

    it('renders plan cards when plans exist', () => {
      const initiative = createMockInitiative();
      const plans = [
        createMockPlan({ plan_id: 'plan-1' }),
        createMockPlan({ plan_id: 'plan-2' }),
      ];
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByTestId('plan-card-plan-1')).toBeInTheDocument();
      expect(screen.getByTestId('plan-card-plan-2')).toBeInTheDocument();
    });

    it('shows empty state when no plans exist', () => {
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      expect(screen.getByText('No plans in this initiative yet')).toBeInTheDocument();
      expect(
        screen.getByText('Create a new plan or add existing plans to this initiative.')
      ).toBeInTheDocument();
    });

    it('shows Create Plan CTA in empty state', () => {
      const initiative = createMockInitiative();
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage();

      const createLink = screen.getByRole('link', { name: /create plan/i });
      expect(createLink).toHaveAttribute('href', '/plans/new?initiative=init-123');
    });

    it('empty state links to plan creation with initiative pre-filled', () => {
      const initiative = createMockInitiative({ initiative_id: 'init-999' });
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      renderPage('init-999');

      const createLink = screen.getByRole('link', { name: /create plan/i });
      expect(createLink).toHaveAttribute('href', '/plans/new?initiative=init-999');
    });
  });

  describe('icon styling', () => {
    it('applies icon background color from initiative color', () => {
      const initiative = createMockInitiative({ color: '#ff6b35' });
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { container } = renderPage();

      const iconContainer = container.querySelector('[style*="background-color"]');
      expect(iconContainer).toHaveStyle({ backgroundColor: '#ff6b3520' });
    });

    it('uses default color when no color provided', () => {
      const initiative = createMockInitiative({ color: undefined });
      vi.mocked(useInitiative).mockReturnValue({
        initiative,
        plans: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
      });

      const { container } = renderPage();

      const iconContainer = container.querySelector('[style*="background-color"]');
      expect(iconContainer).toHaveStyle({ backgroundColor: '#00d9ff20' });
    });
  });
});
