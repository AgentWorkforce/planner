import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PlansListPage } from '../PlansListPage';
import type { PlanSummary, AttentionType } from '@/types';
import type { PlansFilter } from '@/hooks/usePlansFilter';

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
}));

// Mock components to simplify testing
vi.mock('@/components/NeedsAttentionSection', () => ({
  NeedsAttentionSection: ({ plans }: { plans: PlanSummary[] }) => (
    <div data-testid="needs-attention-section">
      {plans.length > 0 && <div>Needs Attention: {plans.length}</div>}
    </div>
  ),
}));

vi.mock('@/components/WorkingOnSection', () => ({
  WorkingOnSection: ({ plans }: { plans: PlanSummary[] }) => (
    <div data-testid="working-on-section">
      {plans.length > 0 && <div>Working On: {plans.length}</div>}
    </div>
  ),
}));

vi.mock('@/components/AttentionSkeleton', () => ({
  PlansListSkeleton: () => <div data-testid="plans-list-skeleton">Loading...</div>,
}));

vi.mock('@/components/CollapsibleSection', () => ({
  CollapsibleSection: ({
    title,
    count,
    children,
  }: {
    title: string;
    count: number;
    children: React.ReactNode;
  }) => (
    <div data-testid="collapsible-section">
      <h2>
        {title} {count !== undefined && `(${count})`}
      </h2>
      {children}
    </div>
  ),
}));

vi.mock('@/components/PlanCard', () => ({
  PlanCard: ({ plan }: { plan: PlanSummary }) => (
    <div data-testid="plan-card" data-plan-id={plan.plan_id}>
      {plan.goal}
    </div>
  ),
}));

vi.mock('@/components/ScopeGroup', () => ({
  ScopeGroup: ({
    scopeName,
    plans,
    isExpanded,
    onToggle,
  }: {
    scopeName: string;
    plans: PlanSummary[];
    isExpanded: boolean;
    onToggle: () => void;
  }) => (
    <div data-testid="scope-group" data-scope={scopeName}>
      <button onClick={onToggle}>
        {scopeName} ({plans.length}) - {isExpanded ? 'Expanded' : 'Collapsed'}
      </button>
    </div>
  ),
}));

vi.mock('@/components/plans/PlansToolbar', () => ({
  PlansToolbar: ({
    title,
    filter,
    onFilterChange,
    viewMode,
    onViewModeChange,
  }: {
    title: string;
    filter: PlansFilter;
    onFilterChange: (filter: Partial<PlansFilter>) => void;
    viewMode: 'list' | 'grouped';
    onViewModeChange: (mode: 'list' | 'grouped') => void;
  }) => (
    <div data-testid="plans-toolbar">
      <h1>{title}</h1>
      <button onClick={() => onFilterChange({ status: 'draft' })}>Filter: Draft</button>
      <button onClick={() => onFilterChange({ initiative_id: 'init-1' })}>
        Filter: Initiative
      </button>
      <button onClick={() => onViewModeChange('grouped')}>View: Grouped</button>
      <div>Current Status: {filter.status}</div>
      <div>Current View: {viewMode}</div>
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

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/plans']}>
      <PlansListPage />
    </MemoryRouter>
  );
}

describe('PlansListPage', () => {
  const mockSetFilter = vi.fn();
  const mockSetViewMode = vi.fn();
  const mockToggleExpansion = vi.fn();
  const mockExpandAll = vi.fn();
  const mockCollapseAll = vi.fn();
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
      viewMode: 'list',
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
      expandAll: mockExpandAll,
      collapseAll: mockCollapseAll,
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

    it('passes filter to PlansToolbar', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Current Status: all')).toBeInTheDocument();
      });
    });

    it('passes viewMode to PlansToolbar', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Current View: list')).toBeInTheDocument();
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

    it('does not show attention sections when no plans exist', async () => {
      vi.mocked(listPlans).mockResolvedValue({ plans: [] });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.queryByTestId('needs-attention-section')).not.toBeInTheDocument();
      });
    });
  });

  describe('attention sections', () => {
    it('renders NeedsAttentionSection when plans exist', async () => {
      const plans = [createMockPlanSummary()];
      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [plans[0]],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('needs-attention-section')).toBeInTheDocument();
      });
    });

    it('renders WorkingOnSection when plans exist', async () => {
      const plans = [createMockPlanSummary()];
      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [plans[0]],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('working-on-section')).toBeInTheDocument();
      });
    });

    it('passes correct plans to NeedsAttentionSection', async () => {
      const plan1 = createMockPlanSummary({
        plan_id: 'plan-1',
        attention_types: ['awaiting_approval'],
      });
      const plan2 = createMockPlanSummary({ plan_id: 'plan-2' });
      const plans = [plan1, plan2];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [plan1],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Needs Attention: 1')).toBeInTheDocument();
      });
    });

    it('passes correct plans to WorkingOnSection', async () => {
      const plan1 = createMockPlanSummary({
        plan_id: 'plan-1',
        attention_types: ['active'],
      });
      const plan2 = createMockPlanSummary({ plan_id: 'plan-2' });
      const plans = [plan1, plan2];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [plan1],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Working On: 1')).toBeInTheDocument();
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
    it('displays plans in list view by default', async () => {
      const plans = [
        createMockPlanSummary({ plan_id: 'plan-1', goal: 'Plan 1' }),
        createMockPlanSummary({ plan_id: 'plan-2', goal: 'Plan 2' }),
      ];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        const planCards = screen.getAllByTestId('plan-card');
        expect(planCards).toHaveLength(2);
        expect(screen.queryByTestId('scope-group')).not.toBeInTheDocument();
      });
    });

    it('displays plans in grouped view when viewMode is "grouped"', async () => {
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
        viewMode: 'grouped',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getAllByTestId('scope-group')).toHaveLength(2);
      });
    });

    it('shows expand/collapse controls in grouped view', async () => {
      const plans = [createMockPlanSummary({ scopes: ['frontend'] })];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansViewMode).mockReturnValue({
        viewMode: 'grouped',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Expand all')).toBeInTheDocument();
        expect(screen.getByText('Collapse all')).toBeInTheDocument();
      });
    });

    it('calls expandAll when Expand all clicked', async () => {
      const user = userEvent.setup();
      const plans = [createMockPlanSummary({ scopes: ['frontend'] })];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansViewMode).mockReturnValue({
        viewMode: 'grouped',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Expand all')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Expand all'));
      expect(mockExpandAll).toHaveBeenCalled();
    });

    it('calls collapseAll when Collapse all clicked', async () => {
      const user = userEvent.setup();
      const plans = [createMockPlanSummary({ scopes: ['frontend'] })];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(usePlansViewMode).mockReturnValue({
        viewMode: 'grouped',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Collapse all')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Collapse all'));
      expect(mockCollapseAll).toHaveBeenCalled();
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

  describe('scope grouping', () => {
    it('groups plans by scope in grouped view', async () => {
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
        viewMode: 'grouped',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        const scopeGroups = screen.getAllByTestId('scope-group');
        expect(scopeGroups).toHaveLength(2);
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
        viewMode: 'grouped',
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
        viewMode: 'grouped',
        setViewMode: mockSetViewMode,
      });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        const scopeGroups = screen.getAllByTestId('scope-group');
        expect(scopeGroups).toHaveLength(3);
      });

      const scopeGroups = screen.getAllByTestId('scope-group');

      // Check order: alpha, zebra, Uncategorized
      expect(scopeGroups[0].textContent).toContain('alpha');
      expect(scopeGroups[1].textContent).toContain('zebra');
      expect(scopeGroups[2].textContent).toContain('Uncategorized');
    });
  });

  describe('All Plans section', () => {
    it('shows count of all plans in section header', async () => {
      const plans = [
        createMockPlanSummary({ plan_id: 'plan-1' }),
        createMockPlanSummary({ plan_id: 'plan-2' }),
        createMockPlanSummary({ plan_id: 'plan-3' }),
      ];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [],
        workingOn: [],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        // The collapsible section should be rendered
        expect(screen.getByTestId('collapsible-section')).toBeInTheDocument();
        // And it should contain the title and count
        expect(screen.getByText(/All Plans/)).toBeInTheDocument();
        expect(screen.getByText(/\(3\)/)).toBeInTheDocument();
      });
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

    it('correctly categorizes plans across attention sections', async () => {
      const plan1 = createMockPlanSummary({
        plan_id: 'plan-1',
        goal: 'Needs Attention',
        attention_types: ['awaiting_approval'],
      });
      const plan2 = createMockPlanSummary({
        plan_id: 'plan-2',
        goal: 'Working On',
        attention_types: ['active'],
      });
      const plan3 = createMockPlanSummary({
        plan_id: 'plan-3',
        goal: 'Regular Plan',
      });
      const plans = [plan1, plan2, plan3];

      vi.mocked(listPlans).mockResolvedValue({ plans });
      vi.mocked(useAttentionPlans).mockReturnValue({
        needsAttention: [plan1],
        workingOn: [plan2],
        allOther: plans,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Needs Attention: 1')).toBeInTheDocument();
        expect(screen.getByText('Working On: 1')).toBeInTheDocument();
        expect(screen.getByText('Regular Plan')).toBeInTheDocument();
      });
    });
  });
});
