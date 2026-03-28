import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InitiativeCollapsible } from '../InitiativeCollapsible';
import type { PlanStatus } from '@/types';

// Mock matchMedia for sidebar tests
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock the icons
vi.mock('@/components/icons', () => ({
  ChevronRightIcon: ({ size, className }: { size?: string; className?: string }) => (
    <div data-testid="chevron-icon" data-size={size} className={className} />
  ),
}));

// Import SidebarProvider for wrapping components
import { SidebarProvider } from '@/components/ui/sidebar';

describe('InitiativeCollapsible', () => {
  const mockInitiative = {
    initiative_id: 'init-1',
    name: 'Q1 Goals',
    icon: '🎯',
    color: '#3b82f6',
  };

  const mockPlans = [
    {
      plan_id: 'plan-1',
      goal: 'Implement user authentication',
      status: 'draft' as PlanStatus,
    },
    {
      plan_id: 'plan-2',
      goal: 'Add payment processing',
      status: 'approved' as PlanStatus,
    },
    {
      plan_id: 'plan-3',
      goal: 'Deploy to production',
      status: 'published' as PlanStatus,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderInitiativeCollapsible = (
    props: {
      initiative?: typeof mockInitiative;
      plans?: typeof mockPlans;
      isExpanded?: boolean;
      onToggleExpanded?: () => void;
    } = {},
    initialRoute = '/'
  ) => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <SidebarProvider>
          <InitiativeCollapsible
            initiative={props.initiative || mockInitiative}
            plans={props.plans || mockPlans}
            isExpanded={props.isExpanded}
            onToggleExpanded={props.onToggleExpanded}
          />
        </SidebarProvider>
      </MemoryRouter>
    );
  };

  // Helper to click the expand button (chevron)
  const clickExpandButton = async (user: ReturnType<typeof userEvent.setup>) => {
    const expandButton = screen.getByRole('button', { name: /expand|collapse/i });
    await user.click(expandButton);
  };

  describe('initiative header', () => {
    it('renders initiative name', () => {
      renderInitiativeCollapsible();

      expect(screen.getByText('Q1 Goals')).toBeInTheDocument();
    });

    it('renders initiative icon as color dot', () => {
      const { container } = renderInitiativeCollapsible();

      const colorDot = container.querySelector('.h-3.w-3.rounded-full');
      expect(colorDot).toBeInTheDocument();
      expect(colorDot).toHaveStyle({ backgroundColor: '#3b82f6' });
    });

    it('uses default color when initiative color is not provided', () => {
      const { color: _removedColor, ...restInitiative } = mockInitiative;
      const initiativeWithoutColor = restInitiative as typeof mockInitiative;

      const { container } = renderInitiativeCollapsible({
        initiative: initiativeWithoutColor,
      });

      const colorDot = container.querySelector('.h-3.w-3.rounded-full');
      expect(colorDot).toHaveStyle({ backgroundColor: '#6b7280' });
    });

    it('shows plan count badge when plans exist', () => {
      renderInitiativeCollapsible();

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('does not show plan count badge when no plans exist', () => {
      renderInitiativeCollapsible({ plans: [] });

      const badges = screen.queryAllByText(/^\d+$/);
      expect(badges.length).toBe(0);
    });

    it('renders chevron icon when plans exist', () => {
      renderInitiativeCollapsible();

      expect(screen.getByTestId('chevron-icon')).toBeInTheDocument();
    });

    it('does not render chevron when no plans exist', () => {
      renderInitiativeCollapsible({ plans: [] });

      expect(screen.queryByTestId('chevron-icon')).not.toBeInTheDocument();
    });

    it('initiative header links to initiative page', () => {
      renderInitiativeCollapsible();

      const link = screen.getByRole('link', { name: /q1 goals/i });
      expect(link).toHaveAttribute('href', '/initiatives/init-1');
    });
  });

  describe('expand/collapse behavior', () => {
    it('starts collapsed by default in uncontrolled mode', () => {
      renderInitiativeCollapsible();

      // Plans should not be visible
      expect(screen.queryByText('Implement user authentication')).not.toBeInTheDocument();
      expect(screen.queryByText('Add payment processing')).not.toBeInTheDocument();
    });

    it('expands to show plans when chevron is clicked in uncontrolled mode', async () => {
      const user = userEvent.setup();

      renderInitiativeCollapsible();

      // Click the expand button (chevron)
      await clickExpandButton(user);

      // Plans should now be visible
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Add payment processing')).toBeInTheDocument();
      expect(screen.getByText('Deploy to production')).toBeInTheDocument();
    });

    it('collapses to hide plans when chevron is clicked again', async () => {
      const user = userEvent.setup();

      renderInitiativeCollapsible();

      // Expand
      await clickExpandButton(user);
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();

      // Collapse
      await clickExpandButton(user);
      expect(screen.queryByText('Implement user authentication')).not.toBeInTheDocument();
    });

    it('respects controlled isExpanded prop', () => {
      renderInitiativeCollapsible({ isExpanded: true });

      // Plans should be visible
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    });

    it('calls onToggleExpanded when chevron is clicked in controlled mode', async () => {
      const user = userEvent.setup();
      const onToggleExpanded = vi.fn();

      renderInitiativeCollapsible({
        isExpanded: false,
        onToggleExpanded,
      });

      await clickExpandButton(user);

      expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    });

    it('rotates chevron when expanded', async () => {
      const user = userEvent.setup();

      renderInitiativeCollapsible();

      const chevron = screen.getByTestId('chevron-icon');
      expect(chevron).not.toHaveClass('rotate-90');

      // Expand
      await clickExpandButton(user);

      expect(chevron).toHaveClass('rotate-90');
    });
  });

  describe('plan list', () => {
    it('renders all plans when expanded', async () => {
      const user = userEvent.setup();

      renderInitiativeCollapsible();

      await clickExpandButton(user);

      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
      expect(screen.getByText('Add payment processing')).toBeInTheDocument();
      expect(screen.getByText('Deploy to production')).toBeInTheDocument();
    });

    it('renders plan links with correct hrefs', async () => {
      const user = userEvent.setup();

      renderInitiativeCollapsible();

      await clickExpandButton(user);

      const plan1Link = screen.getByRole('link', { name: /implement user authentication/i });
      expect(plan1Link).toHaveAttribute('href', '/plans/plan-1');

      const plan2Link = screen.getByRole('link', { name: /add payment processing/i });
      expect(plan2Link).toHaveAttribute('href', '/plans/plan-2');

      const plan3Link = screen.getByRole('link', { name: /deploy to production/i });
      expect(plan3Link).toHaveAttribute('href', '/plans/plan-3');
    });

    it('shows status indicators for each plan', async () => {
      const user = userEvent.setup();

      const { container } = renderInitiativeCollapsible();

      await clickExpandButton(user);

      // Find status dots (h-2 w-2 rounded-full)
      const statusDots = container.querySelectorAll('.h-2.w-2.rounded-full');
      expect(statusDots.length).toBe(3);
    });

    it('applies correct status color for draft plan', async () => {
      const user = userEvent.setup();

      const { container } = renderInitiativeCollapsible();

      await clickExpandButton(user);

      // Find the draft plan's status dot (first one)
      const statusDots = container.querySelectorAll('.h-2.w-2.rounded-full');
      const draftDot = statusDots[0];
      expect(draftDot).toHaveClass('bg-text-muted');
    });

    it('applies correct status color for approved plan', async () => {
      const user = userEvent.setup();

      const { container } = renderInitiativeCollapsible();

      await clickExpandButton(user);

      const statusDots = container.querySelectorAll('.h-2.w-2.rounded-full');
      const approvedDot = statusDots[1];
      expect(approvedDot).toHaveClass('bg-accent-cyan');
    });

    it('applies correct status color for published plan', async () => {
      const user = userEvent.setup();

      const { container } = renderInitiativeCollapsible();

      await clickExpandButton(user);

      const statusDots = container.querySelectorAll('.h-2.w-2.rounded-full');
      const publishedDot = statusDots[2];
      expect(publishedDot).toHaveClass('bg-accent-green');
    });

    it('does not render plan list when collapsed', () => {
      renderInitiativeCollapsible({ isExpanded: false });

      expect(screen.queryByText('Implement user authentication')).not.toBeInTheDocument();
    });

    it('does not render plan list when expanded but no plans exist', () => {
      renderInitiativeCollapsible({ plans: [], isExpanded: true });

      // No plan links should render (only initiative link)
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(1); // Only the initiative link
    });
  });

  describe('active state', () => {
    it('highlights initiative when on initiative route', () => {
      renderInitiativeCollapsible({}, '/initiatives/init-1');

      const initiativeLink = screen.getByRole('link', { name: /q1 goals/i });
      // The SidebarMenuButton with isActive prop applies [data-active] attribute
      expect(initiativeLink).toHaveAttribute('data-active', 'true');
    });

    it('highlights initiative when one of its plans is active', async () => {
      const user = userEvent.setup();

      renderInitiativeCollapsible({}, '/plans/plan-1');

      // Initiative should be highlighted even though we're on a plan page
      const initiativeLink = screen.getByRole('link', { name: /q1 goals/i });
      expect(initiativeLink).toHaveAttribute('data-active', 'true');

      // Expand to see the plan
      await clickExpandButton(user);

      const planLink = screen.getByRole('link', { name: /implement user authentication/i });
      expect(planLink).toHaveAttribute('data-active', 'true');
    });

    it('highlights specific plan when on that plan route', async () => {
      const user = userEvent.setup();

      renderInitiativeCollapsible({}, '/plans/plan-2');

      await clickExpandButton(user);

      const activePlanLink = screen.getByRole('link', { name: /add payment processing/i });
      expect(activePlanLink).toHaveAttribute('data-active', 'true');

      // Other plans should not be highlighted
      const inactivePlanLink = screen.getByRole('link', { name: /implement user authentication/i });
      expect(inactivePlanLink).not.toHaveAttribute('data-active', 'true');
    });

    it('does not highlight initiative when on unrelated route', () => {
      renderInitiativeCollapsible({}, '/settings');

      const initiativeLink = screen.getByRole('link', { name: /q1 goals/i });
      expect(initiativeLink).not.toHaveAttribute('data-active', 'true');
    });
  });

  describe('accessibility', () => {
    it('has aria-label for status dots', async () => {
      const user = userEvent.setup();

      renderInitiativeCollapsible();

      await clickExpandButton(user);

      // Find status labels
      const draftLabel = screen.getByLabelText('Status: draft');
      expect(draftLabel).toBeInTheDocument();

      const approvedLabel = screen.getByLabelText('Status: approved');
      expect(approvedLabel).toBeInTheDocument();

      const publishedLabel = screen.getByLabelText('Status: published');
      expect(publishedLabel).toBeInTheDocument();
    });

    it('has aria-hidden for decorative color dot', () => {
      const { container } = renderInitiativeCollapsible();

      const colorDot = container.querySelector('.h-3.w-3.rounded-full');
      expect(colorDot).toHaveAttribute('aria-hidden', 'true');
    });

    it('expand button has appropriate aria-label', () => {
      renderInitiativeCollapsible();

      const expandButton = screen.getByRole('button', { name: 'Expand plans' });
      expect(expandButton).toBeInTheDocument();
    });

    it('expand button aria-label changes when expanded', async () => {
      const user = userEvent.setup();

      renderInitiativeCollapsible();

      const button = screen.getByRole('button', { name: 'Expand plans' });
      await user.click(button);

      expect(screen.getByRole('button', { name: 'Collapse plans' })).toBeInTheDocument();
    });

    it('plan items are links with proper href attributes', async () => {
      const user = userEvent.setup();

      renderInitiativeCollapsible();

      await clickExpandButton(user);

      // 1 initiative link + 3 plan links = 4 total
      const links = screen.getAllByRole('link');
      expect(links.length).toBe(4);

      links.forEach((link) => {
        expect(link).toHaveAttribute('href');
      });
    });
  });

  describe('edge cases', () => {
    it('handles empty plan list gracefully', () => {
      renderInitiativeCollapsible({ plans: [] });

      expect(screen.getByText('Q1 Goals')).toBeInTheDocument();
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('handles long initiative names', () => {
      const longNameInitiative = {
        ...mockInitiative,
        name: 'This is a very long initiative name that should be truncated properly',
      };

      renderInitiativeCollapsible({ initiative: longNameInitiative });

      expect(
        screen.getByText('This is a very long initiative name that should be truncated properly')
      ).toBeInTheDocument();
    });

    it('handles long plan goals', async () => {
      const user = userEvent.setup();

      const longGoalPlans = [
        {
          plan_id: 'plan-1',
          goal: 'This is a very long plan goal that should be truncated to fit within the sidebar',
          status: 'draft' as PlanStatus,
        },
      ];

      renderInitiativeCollapsible({ plans: longGoalPlans });

      await clickExpandButton(user);

      expect(
        screen.getByText(
          'This is a very long plan goal that should be truncated to fit within the sidebar'
        )
      ).toBeInTheDocument();
    });

    it('handles plans with different statuses', async () => {
      const user = userEvent.setup();

      const mixedStatusPlans = [
        { plan_id: 'p1', goal: 'Draft Plan', status: 'draft' as PlanStatus },
        { plan_id: 'p2', goal: 'Approved Plan', status: 'approved' as PlanStatus },
        { plan_id: 'p3', goal: 'Published Plan', status: 'published' as PlanStatus },
      ];

      const { container } = renderInitiativeCollapsible({ plans: mixedStatusPlans });

      await clickExpandButton(user);

      const statusDots = container.querySelectorAll('.h-2.w-2.rounded-full');
      expect(statusDots.length).toBe(3);
      expect(statusDots[0]).toHaveClass('bg-text-muted');
      expect(statusDots[1]).toHaveClass('bg-accent-cyan');
      expect(statusDots[2]).toHaveClass('bg-accent-green');
    });
  });
});
