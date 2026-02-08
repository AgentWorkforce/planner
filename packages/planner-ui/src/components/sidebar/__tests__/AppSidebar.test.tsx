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

// Mock the useActiveChannels hook to avoid RelayProvider requirement
vi.mock('@/hooks/useActiveChannels', () => ({
  useActiveChannels: () => ({
    activeChannels: [],
    isLoading: false,
    hasUnreadMessages: () => false,
  }),
}));

// Mock the useCommandPalette hook
vi.mock('@/hooks/useCommandPalette', () => ({
  useCommandPalette: () => ({
    open: vi.fn(),
    close: vi.fn(),
    isOpen: false,
  }),
}));

// Mock the useSidebarState hook
vi.mock('@/hooks/useSidebarState', () => ({
  useSidebarState: () => ({
    isInitiativeExpanded: () => false,
    toggleInitiativeExpanded: vi.fn(),
  }),
}));

// Mock the useTheme hook
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    effectiveTheme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

// Import SidebarProvider for wrapping components
import { SidebarProvider } from '@/components/ui/sidebar';

// Mock the icons - use importOriginal to get all exports, then override specific ones for testability
vi.mock('@/components/icons', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  // Create a simple icon component factory for test IDs
  const createMockIcon = (name: string) => ({ size }: { size?: string }) => (
    <div data-testid={`${name.toLowerCase()}-icon`} data-size={size} />
  );
  return {
    ...actual,
    PlansIcon: createMockIcon('plans'),
    PipelineIcon: createMockIcon('pipeline'),
    InitiativesIcon: createMockIcon('initiatives'),
    SettingsIcon: createMockIcon('settings'),
    PlusIcon: createMockIcon('plus'),
    SearchIcon: createMockIcon('search'),
    ChevronRightIcon: createMockIcon('chevron-right'),
    ChevronDownIcon: createMockIcon('chevron-down'),
    ChannelIcon: createMockIcon('channel'),
    SunIcon: createMockIcon('sun'),
    MoonIcon: createMockIcon('moon'),
  };
});

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

    it('renders Initiatives navigation item', () => {
      renderAppSidebar();

      const initiativesLink = screen.getByRole('link', { name: /initiatives/i });
      expect(initiativesLink).toBeInTheDocument();
      expect(initiativesLink).toHaveAttribute('href', '/initiatives');
      expect(screen.getByTestId('initiatives-icon')).toBeInTheDocument();
    });

    it('renders All Plans navigation item', () => {
      renderAppSidebar();

      const plansLink = screen.getByRole('link', { name: /all plans/i });
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

    it('renders New Plan button', () => {
      renderAppSidebar();

      // New Plan is a button (SidebarMenuButton with onClick), not a link
      expect(screen.getByText('New Plan')).toBeInTheDocument();
    });

    it('renders Search button', () => {
      renderAppSidebar();

      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
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

    it('highlights Plans when on /plans route', () => {
      renderAppSidebar('/plans');

      const plansLink = screen.getByRole('link', { name: /all plans/i });
      expect(plansLink.closest('[data-active]')).toBeTruthy();
    });

    it('highlights Plans when on nested plan route', () => {
      renderAppSidebar('/plans/plan-123');

      const plansLink = screen.getByRole('link', { name: /all plans/i });
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

    it('highlights Initiatives when on /initiatives route', () => {
      renderAppSidebar('/initiatives');

      const initiativesLink = screen.getByRole('link', { name: /initiatives/i });
      expect(initiativesLink.closest('[data-active]')).toBeTruthy();
    });
  });

  describe('theme toggle', () => {
    beforeEach(() => {
      vi.spyOn(useInitiativesHook, 'useInitiatives').mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });
    });

    it('renders theme toggle button', () => {
      renderAppSidebar();

      // In dark mode, it shows "Light Mode" option
      expect(screen.getByText('Light Mode')).toBeInTheDocument();
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
