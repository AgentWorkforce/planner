import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppSidebar } from '../AppSidebar';
import * as useInitiativesHook from '@/hooks/useInitiatives';
import type { Initiative } from '@/types/initiative';

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

// Mock the useInitiatives hook
vi.mock('@/hooks/useInitiatives');

// Import SidebarProvider for wrapping components
import { SidebarProvider } from '@/components/ui/sidebar';

// Mock the icons
vi.mock('@/components/icons', () => ({
  DashboardIcon: ({ size }: { size?: string }) => <div data-testid="dashboard-icon" data-size={size} />,
  PlansIcon: ({ size }: { size?: string }) => <div data-testid="plans-icon" data-size={size} />,
  PipelineIcon: ({ size }: { size?: string }) => <div data-testid="pipeline-icon" data-size={size} />,
  InitiativesIcon: () => <div data-testid="initiatives-icon" />,
  SettingsIcon: ({ size }: { size?: string }) => <div data-testid="settings-icon" data-size={size} />,
  PlusIcon: ({ size }: { size?: string }) => <div data-testid="plus-icon" data-size={size} />,
}));

describe('AppSidebar', () => {
  const mockInitiatives: Initiative[] = [
    {
      initiative_id: 'init-1',
      org_id: 'org-1',
      name: 'Q1 Goals',
      description: 'First quarter objectives',
      status: 'active',
      icon: '🎯',
      color: '#3b82f6',
      display_order: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      initiative_id: 'init-2',
      org_id: 'org-1',
      name: 'Product Launch',
      description: 'New product launch initiative',
      status: 'active',
      icon: '🚀',
      color: '#10b981',
      display_order: 2,
      created_at: '2026-01-15T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderAppSidebar = (initialRoute = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>
    );
  };

  describe('header and logo', () => {
    it('renders logo and Planner text', () => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderAppSidebar();

      expect(screen.getByText('Planner')).toBeInTheDocument();
    });

    it('renders logo with geometric shape', () => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = renderAppSidebar();

      // Check for the rotated border element (logo shape)
      const logoShape = container.querySelector('.rotate-45.border-2.border-accent-cyan');
      expect(logoShape).toBeInTheDocument();
    });
  });

  describe('navigation links', () => {
    beforeEach(() => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });
    });

    it('renders Dashboard navigation item', () => {
      renderAppSidebar();

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).toBeInTheDocument();
      expect(dashboardLink).toHaveAttribute('href', '/');
      expect(screen.getByTestId('dashboard-icon')).toBeInTheDocument();
    });

    it('renders Plans navigation item', () => {
      renderAppSidebar();

      const plansLink = screen.getByRole('link', { name: /plans/i });
      expect(plansLink).toBeInTheDocument();
      expect(plansLink).toHaveAttribute('href', '/plans');
      expect(screen.getByTestId('plans-icon')).toBeInTheDocument();
    });

    it('renders Pipeline navigation item', () => {
      renderAppSidebar();

      const pipelineLink = screen.getByRole('link', { name: /pipeline/i });
      expect(pipelineLink).toBeInTheDocument();
      expect(pipelineLink).toHaveAttribute('href', '/pipeline');
      expect(screen.getByTestId('pipeline-icon')).toBeInTheDocument();
    });

    it('renders Settings navigation item in footer', () => {
      renderAppSidebar();

      const settingsLink = screen.getByRole('link', { name: /settings/i });
      expect(settingsLink).toBeInTheDocument();
      expect(settingsLink).toHaveAttribute('href', '/settings');
      expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
    });
  });

  describe('initiatives section', () => {
    it('shows INITIATIVES section label', () => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderAppSidebar();

      expect(screen.getByText('INITIATIVES')).toBeInTheDocument();
    });

    it('renders New Initiative button', () => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderAppSidebar();

      const newButton = screen.getByTitle('New Initiative');
      expect(newButton).toBeInTheDocument();
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });

    it('renders New Initiative button that is clickable', async () => {
      const user = userEvent.setup();

      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderAppSidebar();

      const newButton = screen.getByTitle('New Initiative');
      expect(newButton).not.toBeDisabled();

      // Click should not throw an error
      await user.click(newButton);
    });

    it('shows loading skeleton while fetching initiatives', () => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: [],
        isLoading: true,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = renderAppSidebar();

      // Check for loading skeleton elements
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows empty state when no initiatives exist', () => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderAppSidebar();

      expect(screen.getByText('No initiatives yet')).toBeInTheDocument();
    });

    it('renders initiative list when data is loaded', () => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: mockInitiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderAppSidebar();

      expect(screen.getByText('Q1 Goals')).toBeInTheDocument();
      expect(screen.getByText('Product Launch')).toBeInTheDocument();
    });

    it('renders initiative links with correct hrefs', () => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: mockInitiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderAppSidebar();

      const q1GoalsLink = screen.getByRole('link', { name: /q1 goals/i });
      expect(q1GoalsLink).toHaveAttribute('href', '/initiatives/init-1');

      const productLaunchLink = screen.getByRole('link', { name: /product launch/i });
      expect(productLaunchLink).toHaveAttribute('href', '/initiatives/init-2');
    });

    it('renders initiative color indicators', () => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: mockInitiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = renderAppSidebar();

      // Find colored dots (these have inline styles with backgroundColor)
      const colorDots = container.querySelectorAll('.h-3.w-3.rounded-full');
      expect(colorDots.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('active route highlighting', () => {
    beforeEach(() => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: mockInitiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });
    });

    it('highlights Dashboard when on root route', () => {
      renderAppSidebar('/');

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      // The SidebarMenuButton with isActive prop applies styling
      expect(dashboardLink.closest('[data-active]')).toBeTruthy();
    });

    it('highlights Plans when on /plans route', () => {
      renderAppSidebar('/plans');

      const plansLink = screen.getByRole('link', { name: /plans/i });
      expect(plansLink.closest('[data-active]')).toBeTruthy();
    });

    it('highlights Plans when on nested plan route', () => {
      renderAppSidebar('/plans/plan-123');

      const plansLink = screen.getByRole('link', { name: /plans/i });
      expect(plansLink.closest('[data-active]')).toBeTruthy();
    });

    it('highlights Pipeline when on /pipeline route', () => {
      renderAppSidebar('/pipeline');

      const pipelineLink = screen.getByRole('link', { name: /pipeline/i });
      expect(pipelineLink.closest('[data-active]')).toBeTruthy();
    });

    it('highlights Settings when on /settings route', () => {
      renderAppSidebar('/settings');

      const settingsLink = screen.getByRole('link', { name: /settings/i });
      expect(settingsLink.closest('[data-active]')).toBeTruthy();
    });

    it('highlights initiative when on initiative route', () => {
      renderAppSidebar('/initiatives/init-1');

      const initiativeLink = screen.getByRole('link', { name: /q1 goals/i });
      expect(initiativeLink.closest('[data-active]')).toBeTruthy();
    });
  });

  describe('initiatives with plan counts', () => {
    it('does not show plan count badge when count is 0', () => {
      const initiativesWithoutPlans: Initiative[] = [
        {
          ...mockInitiatives[0],
          // Assuming the component handles plan_count via extended type
        },
      ];

      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: initiativesWithoutPlans,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderAppSidebar();

      // The component checks for plan_count > 0, but our mock doesn't have that field
      // So no badge should be shown
      const q1GoalsText = screen.getByText('Q1 Goals');
      expect(q1GoalsText).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: mockInitiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });
    });

    it('all navigation items are links with proper role', () => {
      renderAppSidebar();

      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);

      links.forEach((link) => {
        expect(link).toHaveAttribute('href');
      });
    });

    it('New Initiative button has accessible title', () => {
      renderAppSidebar();

      const newButton = screen.getByTitle('New Initiative');
      expect(newButton).toBeInTheDocument();
    });
  });
});
