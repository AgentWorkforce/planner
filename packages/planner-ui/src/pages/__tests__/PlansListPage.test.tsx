import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PlansListPage } from '../PlansListPage';
import type { PlanSummary, AttentionType } from '@/types';
import type { PlansFilter } from '@/hooks/usePlansFilter';
import type { PlansViewMode } from '@/hooks';

// Mock API functions
vi.mock('@/api', () => ({
  listPlans: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

// Mock hooks
vi.mock('@/hooks', () => ({
  usePlansFilter: vi.fn(),
  usePlansViewMode: vi.fn(),
  useAttentionPlans: vi.fn(),
  useScopeGroupExpansion: vi.fn(),
  useFuzzySearch: vi.fn(),
  useInitiatives: vi.fn(),
  useCurrentUser: vi.fn(() => ({
    userId: 'test-user-id',
    sessionId: 'test-session-id',
  })),
}));

vi.mock('@/components/AttentionSkeleton', () => ({
  PlansListSkeleton: () => <div data-testid="plans-list-skeleton">Loading...</div>,
}));

vi.mock('@/components/PlanCard', () => ({
  PlanCard: ({ plan }: { plan: PlanSummary }) => (
    <div data-testid="plan-card" data-plan-id={plan.plan_id}>
      {plan.goal}
    </div>
  ),
}));

vi.mock('@/components/PlanTable', () => ({
  PlanTable: ({ plans }: { plans: PlanSummary[] }) => (
    <div data-testid="plan-table">
      {plans.map((plan) => (
        <div key={plan.plan_id} data-testid="plan-table-row" data-plan-id={plan.plan_id}>
          {plan.goal}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/SectionedPlanTable', () => ({
  SectionedPlanTable: ({
    scopeGroups,
    sortedScopeNames,
  }: {
    scopeGroups: Map<string, PlanSummary[]>;
    sortedScopeNames: string[];
    isExpanded: (scope: string) => boolean;
    onToggle: (scope: string) => void;
  }) => (
    <div data-testid="sectioned-plan-table">
      {sortedScopeNames.map((scope) => (
        <div key={scope} data-testid="scope-section" data-scope={scope}>
          <span>{scope}</span>
          <span>({scopeGroups.get(scope)?.length || 0} plans)</span>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/plans/PlansToolbar', () => ({
  PlansToolbar: ({
    title,
    filter,
    viewMode,
    onFilterChange,
    onViewModeChange,
  }: {
    title: string;
    filter: PlansFilter;
    onFilterChange: (filter: Partial<PlansFilter>) => void;
    viewMode: PlansViewMode;
    onViewModeChange: (mode: PlansViewMode) => void;
  }) => (
    <div data-testid="plans-toolbar">
      <h1>{title}</h1>
      <button onClick={() => onFilterChange({ status: 'draft' })}>Filter: Draft</button>
      <button onClick={() => onFilterChange({ initiative_id: 'init-1' })}>
        Filter: Initiative
      </button>
      <button onClick={() => onViewModeChange('table')}>View: Table</button>
      <button onClick={() => onViewModeChange('sectioned')}>View: Sectioned</button>
      <button onClick={() => onViewModeChange('cards')}>View: Cards</button>
      <div data-testid="current-status">Current Status: {filter.status}</div>
      <div data-testid="current-view">Current View: {viewMode}</div>
    </div>
  ),
}));

// Mock utility functions
vi.mock('@/utils/scopeGrouping', () => ({
  groupPlansByScope: vi.fn((plans: PlanSummary[]) => {
    const groups = new Map<string, PlanSummary[]>();
    plans.forEach((plan) => {
      const scope = plan.scopes?.[0] || 'Uncategorized';
      if (!groups.has(scope)) {
        groups.set(scope, []);
      }
      groups.get(scope)!.push(plan);
    });
    return groups;
  }),
}));

import { listPlans } from '@/api';
import {
  usePlansFilter,
  usePlansViewMode,
  useAttentionPlans,
  useScopeGroupExpansion,
  useFuzzySearch,
  useInitiatives,
} from '@/hooks';

function createMockPlanSummary(
  overrides?: Partial<PlanSummary> & { attention_types?: AttentionType[] }
): PlanSummary {
  return {
    plan_id: 'plan-1',
    goal: 'Test Plan Goal',
    status: 'draft',
    latest_version: 1,
    scopes: ['frontend'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderWithRouter(initialEntries: string[] = ['/plans']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PlansListPage />
    </MemoryRouter>
  );
}

describe('PlansListPage', () => {
  const mockSetFilter = vi.fn();
  const mockSetViewMode = vi.fn();
  const mockToggleExpansion = vi.fn();
  const mockIsExpanded = vi.fn();

  const defaultFilter: PlansFilter = {
    status: 'all',
    initiative_id: null,
    owner_user_id: null,
    search: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(usePlansFilter).mockReturnValue({
      filter: defaultFilter,
      setFilter: mockSetFilter,
    });

    vi.mocked(usePlansViewMode).mockReturnValue({
      viewMode: 'table',
      setViewMode: mockSetViewMode,
    });

    vi.mocked(useAttentionPlans).mockReturnValue({
      needsAttention: [],
      workingOn: [],
      allOther: [],
    });

    vi.mocked(useScopeGroupExpansion).mockReturnValue({
      isExpanded: mockIsExpanded,
      toggleExpansion: mockToggleExpansion,
      expandAll: vi.fn(),
      collapseAll: vi.fn(),
    });

    vi.mocked(useFuzzySearch).mockReturnValue([]);

    vi.mocked(useInitiatives).mockReturnValue({
      initiatives: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    vi.mocked(mockIsExpanded).mockReturnValue(false);
  });

  describe('PlansToolbar rendering', () => {
    it('renders PlansToolbar component', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('plans-toolbar')).toBeInTheDocument();
      });
    });

    it('passes title "Plans" to PlansToolbar', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Plans')).toBeInTheDocument();
      });
    });

    it('passes title "My Plans" on /plans/my route', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter(['/plans/my']);

      await waitFor(() => {
        expect(screen.getByText('My Plans')).toBeInTheDocument();
      });
    });

    it('passes filter to PlansToolbar', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('current-status')).toHaveTextContent('Current Status: all');
      });
    });

    it('passes viewMode to PlansToolbar', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('current-view')).toHaveTextContent('Current View: table');
      });
    });
  });

  describe('loading state', () => {
    it('shows loading skeleton while fetching plans', () => {
      vi.mocked(listPlans).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithRouter();

      expect(screen.getByTestId('plans-list-skeleton')).toBeInTheDocument();
    });

    it('hides loading skeleton after data is loaded', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.queryByTestId('plans-list-skeleton')).not.toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('displays error message when API fails', async () => {
      vi.mocked(listPlans).mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Failed to load plans')).toBeInTheDocument();
      });
    });

    it('displays custom error message from ApiError', async () => {
      const ApiError = (await import('@/api')).ApiError;
      vi.mocked(listPlans).mockRejectedValue(new ApiError('Custom error message'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Custom error message')).toBeInTheDocument();
      });
    });
  });

  describe('empty state', () => {
    it('shows empty state when no plans exist', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('No plans yet')).toBeInTheDocument();
        expect(
          screen.getByText(/create your first plan using the/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('status filter', () => {
    it('filters plans by status', async () => {
      const draftPlan = createMockPlanSummary({
        plan_id: 'draft-1',
        status: 'draft',
        goal: 'Draft Plan',
      });
      const approvedPlan = createMockPlanSummary({
        plan_id: 'approved-1',
        status: 'approved',
        goal: 'Approved Plan',
      });
      const plans = [draftPlan, approvedPlan];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansFilter).mockReturnValue({
        filter: { ...defaultFilter, status: 'draft' },
        setFilter: mockSetFilter,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Draft Plan')).toBeInTheDocument();
        expect(screen.queryByText('Approved Plan')).not.toBeInTheDocument();
      });
    });

    it('shows all plans when status is "all"', async () => {
      const draftPlan = createMockPlanSummary({
        plan_id: 'draft-1',
        status: 'draft',
        goal: 'Draft Plan',
      });
      const approvedPlan = createMockPlanSummary({
        plan_id: 'approved-1',
        status: 'approved',
        goal: 'Approved Plan',
      });
      const plans = [draftPlan, approvedPlan];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Draft Plan')).toBeInTheDocument();
        expect(screen.getByText('Approved Plan')).toBeInTheDocument();
      });
    });
  });

  describe('initiative filter', () => {
    it('filters plans by initiative_id', async () => {
      const plan1 = createMockPlanSummary({
        plan_id: 'plan-1',
        initiative_id: 'init-1',
        goal: 'Initiative Plan',
      });
      const plan2 = createMockPlanSummary({
        plan_id: 'plan-2',
        goal: 'No Initiative Plan',
      });
      const plans = [plan1, plan2];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansFilter).mockReturnValue({
        filter: { ...defaultFilter, initiative_id: 'init-1' },
        setFilter: mockSetFilter,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Initiative Plan')).toBeInTheDocument();
        expect(screen.queryByText('No Initiative Plan')).not.toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('uses fuzzy search results when search term provided', async () => {
      const plan1 = createMockPlanSummary({
        plan_id: 'plan-1',
        goal: 'Frontend Development',
      });
      const plan2 = createMockPlanSummary({
        plan_id: 'plan-2',
        goal: 'Backend Development',
      });
      const plans = [plan1, plan2];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansFilter).mockReturnValue({
        filter: { ...defaultFilter, search: 'frontend' },
        setFilter: mockSetFilter,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });
      vi.mocked(useFuzzySearch).mockReturnValue([{ plan: plan1, score: 0.9 }]);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Frontend Development')).toBeInTheDocument();
        expect(screen.queryByText('Backend Development')).not.toBeInTheDocument();
      });
    });
  });

  describe('view mode toggle', () => {
    it('displays plans in table view by default', async () => {
      const plans = [
        createMockPlanSummary({ plan_id: 'plan-1', goal: 'Plan 1' }),
        createMockPlanSummary({ plan_id: 'plan-2', goal: 'Plan 2' }),
      ];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansViewMode).mockReturnValue({
        viewMode: 'table',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('plan-table')).toBeInTheDocument();
        const planRows = screen.getAllByTestId('plan-table-row');
        expect(planRows).toHaveLength(2);
      });
    });

    it('displays plans in cards view when viewMode is "cards"', async () => {
      const plans = [
        createMockPlanSummary({ plan_id: 'plan-1', goal: 'Plan 1' }),
        createMockPlanSummary({ plan_id: 'plan-2', goal: 'Plan 2' }),
      ];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansViewMode).mockReturnValue({
        viewMode: 'cards',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        const planCards = screen.getAllByTestId('plan-card');
        expect(planCards).toHaveLength(2);
        expect(screen.queryByTestId('plan-table')).not.toBeInTheDocument();
      });
    });

    it('displays plans in sectioned view when viewMode is "sectioned"', async () => {
      const plans = [
        createMockPlanSummary({
          plan_id: 'plan-1',
          goal: 'Plan 1',
          scopes: ['frontend'],
        }),
        createMockPlanSummary({
          plan_id: 'plan-2',
          goal: 'Plan 2',
          scopes: ['backend'],
        }),
      ];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansViewMode).mockReturnValue({
        viewMode: 'sectioned',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('sectioned-plan-table')).toBeInTheDocument();
        const scopeSections = screen.getAllByTestId('scope-section');
        expect(scopeSections).toHaveLength(2);
      });
    });

    it('calls setViewMode when view mode button is clicked', async () => {
      const user = userEvent.setup();
      const plans = [createMockPlanSummary()];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('View: Sectioned')).toBeInTheDocument();
      });

      await user.click(screen.getByText('View: Sectioned'));
      expect(mockSetViewMode).toHaveBeenCalledWith('sectioned');
    });
  });

  describe('empty state after filtering', () => {
    it('shows "No matching plans" when search has no results', async () => {
      const plans = [createMockPlanSummary()];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansFilter).mockReturnValue({
        filter: { ...defaultFilter, search: 'nonexistent' },
        setFilter: mockSetFilter,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });
      vi.mocked(useFuzzySearch).mockReturnValue([]);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('No matching plans')).toBeInTheDocument();
        expect(screen.getByText('Try adjusting your search terms')).toBeInTheDocument();
      });
    });

    it('shows "No plans found" when filter has no results', async () => {
      const plans = [createMockPlanSummary({ status: 'draft' })];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansFilter).mockReturnValue({
        filter: { ...defaultFilter, status: 'published' },
        setFilter: mockSetFilter,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('No plans found')).toBeInTheDocument();
        expect(screen.getByText(/no published plans in this category/i)).toBeInTheDocument();
      });
    });
  });

  describe('scope grouping in sectioned view', () => {
    it('groups plans by scope in sectioned view', async () => {
      const plans = [
        createMockPlanSummary({
          plan_id: 'plan-1',
          goal: 'Frontend Plan',
          scopes: ['frontend'],
        }),
        createMockPlanSummary({
          plan_id: 'plan-2',
          goal: 'Backend Plan',
          scopes: ['backend'],
        }),
      ];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansViewMode).mockReturnValue({
        viewMode: 'sectioned',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        const scopeSections = screen.getAllByTestId('scope-section');
        expect(scopeSections).toHaveLength(2);
      });
    });

    it('places plans without scope in "Uncategorized" group', async () => {
      const plans = [
        createMockPlanSummary({
          plan_id: 'plan-1',
          goal: 'Uncategorized Plan',
          scopes: undefined,
        }),
      ];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansViewMode).mockReturnValue({
        viewMode: 'sectioned',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/Uncategorized/)).toBeInTheDocument();
      });
    });

    it('sorts scope groups alphabetically with Uncategorized last', async () => {
      const plans = [
        createMockPlanSummary({ plan_id: 'plan-1', scopes: ['zebra'] }),
        createMockPlanSummary({ plan_id: 'plan-2', scopes: ['alpha'] }),
        createMockPlanSummary({ plan_id: 'plan-3', scopes: undefined }),
      ];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansViewMode).mockReturnValue({
        viewMode: 'sectioned',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        const scopeSections = screen.getAllByTestId('scope-section');
        expect(scopeSections).toHaveLength(3);
      });

      const scopeSections = screen.getAllByTestId('scope-section');

      // Check order: alpha, zebra, Uncategorized
      expect(scopeSections[0]).toHaveAttribute('data-scope', 'alpha');
      expect(scopeSections[1]).toHaveAttribute('data-scope', 'zebra');
      expect(scopeSections[2]).toHaveAttribute('data-scope', 'Uncategorized');
    });
  });

  describe('integration', () => {
    it('fetches plans on mount', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter();

      await waitFor(() => {
        expect(listPlans).toHaveBeenCalled();
      });
    });

    it('renders complete flow: loading -> data -> display', async () => {
      const plans = [
        createMockPlanSummary({ plan_id: 'plan-1', goal: 'Test Plan' }),
      ];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      // Loading state
      expect(screen.getByTestId('plans-list-skeleton')).toBeInTheDocument();

      // Data loaded
      await waitFor(() => {
        expect(screen.queryByTestId('plans-list-skeleton')).not.toBeInTheDocument();
        expect(screen.getByText('Test Plan')).toBeInTheDocument();
      });
    });
  });
});
