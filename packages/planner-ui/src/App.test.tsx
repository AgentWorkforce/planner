import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

// Mock matchMedia for useTheme hook
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

// Mock ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock the RelayProvider, ToastProvider, and useRelay to avoid WebSocket setup
vi.mock('@/contexts', () => ({
  RelayProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRelay: vi.fn(() => ({
    connection: {
      onMessage: vi.fn(() => vi.fn()), // Returns unsubscribe function
      onChannelMessage: vi.fn(() => vi.fn()), // Returns unsubscribe function
      sendMessage: vi.fn(),
      joinChannel: vi.fn(),
      leaveChannel: vi.fn(),
    },
    connectionStatus: 'connected',
    sendMessage: vi.fn(),
    joinChannel: vi.fn(),
    leaveChannel: vi.fn(),
  })),
  useToastContext: vi.fn(() => ({
    toasts: [],
    addToast: vi.fn(),
    removeToast: vi.fn(),
  })),
}));

// Mock hooks to avoid API calls and complex setup
vi.mock('@/hooks', () => ({
  useCommandPalette: vi.fn(() => ({ isOpen: false, close: vi.fn() })),
  useRecentPlans: vi.fn(() => ({ recentPlanIds: [], addRecent: vi.fn() })),
  useAgentOrchestration: vi.fn(() => ({
    agents: [],
    pendingQuestions: 0,
    resolvedDecisions: 0,
    sessionDuration: 0,
  })),
  useQuestionQueue: vi.fn(() => ({
    questions: [],
    currentQuestion: null,
    answer: vi.fn(),
    dismiss: vi.fn(),
  })),
  useQuestionNotifications: vi.fn(() => ({
    currentNotification: null,
    dismiss: vi.fn(),
    addToQueue: vi.fn(),
  })),
  useDmChannel: vi.fn(() => ({
    openDm: vi.fn(),
  })),
  useInitiatives: vi.fn(() => ({
    initiatives: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  })),
  useActiveChannels: vi.fn(() => ({
    activeChannels: [],
    hasUnreadMessages: () => false,
  })),
}));

// Mock API functions
vi.mock('@/api', () => ({
  listPlans: vi.fn().mockResolvedValue({ plans: [] }),
  getPlan: vi.fn().mockResolvedValue(null),
}));

// Mock pages to simplify testing
vi.mock('@/pages', () => ({
  PlansListPage: () => <div data-testid="plans-list-page">Plans List</div>,
  NewPlanPage: () => <div data-testid="new-plan-page">New Plan</div>,
  PlanEditorPage: () => <div data-testid="plan-editor-page">Plan Editor</div>,
  ChannelPage: () => <div data-testid="channel-page">Channel</div>,
}));

vi.mock('./pages/InitiativesListPage', () => ({
  InitiativesListPage: () => <div data-testid="initiatives-page">Initiatives</div>,
}));

vi.mock('./pages/InitiativeDetailPage', () => ({
  InitiativeDetailPage: () => <div data-testid="initiative-detail-page">Initiative Detail</div>,
}));

vi.mock('./pages/PipelinePage', () => ({
  PipelinePage: () => <div data-testid="pipeline-page">Pipeline</div>,
}));

// Mock MessagingSidebar to avoid complex hook dependencies
vi.mock('@/components/MessagingSidebar', () => ({
  MessagingSidebar: () => <div data-testid="messaging-sidebar" />,
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);

    // App should render - Layout contains SidebarProvider and pages
    expect(document.body).toBeInTheDocument();
  });

  it('renders the sidebar with brand', () => {
    render(<App />);

    // Brand "Planner" should be visible in sidebar (may appear multiple times)
    const plannerElements = screen.getAllByText('Planner');
    expect(plannerElements.length).toBeGreaterThan(0);
  });

  it('renders navigation elements', () => {
    render(<App />);

    // Should have navigation links in sidebar
    expect(screen.getByRole('link', { name: /plans/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pipeline/i })).toBeInTheDocument();
  });

  it('redirects to /plans by default', async () => {
    render(<App />);

    // The default route redirects "/" to "/plans", which shows PlansListPage
    expect(screen.getByTestId('plans-list-page')).toBeInTheDocument();
  });
});
