import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InitiativeTabs } from '../InitiativeTabs';
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

describe('InitiativeTabs', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading skeleton when isLoading is true', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: true,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = render(
        <InitiativeTabs selectedId={null} onSelect={mockOnSelect} />
      );

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons).toHaveLength(3);
    });

    it('applies skeleton styling to loading placeholders', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: true,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = render(
        <InitiativeTabs selectedId={null} onSelect={mockOnSelect} />
      );

      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).toHaveClass('h-8', 'w-24', 'bg-bg-secondary/50', 'rounded-full');
    });
  });

  describe('All tab', () => {
    it('renders "All" tab as first item', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveTextContent('All');
    });

    it('highlights "All" tab when selectedId is null', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const allTab = screen.getByText('All');
      expect(allTab).toHaveAttribute('aria-selected', 'true');
      expect(allTab).toHaveClass('bg-bg-elevated', 'text-text-primary', 'shadow-sm');
    });

    it('does not highlight "All" tab when an initiative is selected', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative({ initiative_id: 'init-1' })],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId="init-1" onSelect={mockOnSelect} />);

      const allTab = screen.getByText('All');
      expect(allTab).toHaveClass('text-text-muted', 'hover:text-text-secondary');
    });

    it('calls onSelect with null when "All" tab is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId="init-1" onSelect={mockOnSelect} />);

      const allTab = screen.getByText('All');
      await user.click(allTab);

      expect(mockOnSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('initiative tabs', () => {
    it('renders initiative tabs with color dots', () => {
      const initiatives = [
        createMockInitiative({
          initiative_id: 'init-1',
          name: 'Q1 Launch',
          color: '#00d9ff',
        }),
        createMockInitiative({
          initiative_id: 'init-2',
          name: 'Q2 Release',
          color: '#ff6b35',
        }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      expect(screen.getByText('Q1 Launch')).toBeInTheDocument();
      expect(screen.getByText('Q2 Release')).toBeInTheDocument();

      const dots = container.querySelectorAll('.w-1\\.5.h-1\\.5.rounded-full');
      expect(dots).toHaveLength(2);
    });

    it('renders initiative icons when present', () => {
      const initiatives = [
        createMockInitiative({
          initiative_id: 'init-1',
          name: 'Q1 Launch',
          icon: '🚀',
        }),
        createMockInitiative({
          initiative_id: 'init-2',
          name: 'Q2 Release',
          icon: '🎯',
        }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      expect(screen.getByText('🚀')).toBeInTheDocument();
      expect(screen.getByText('🎯')).toBeInTheDocument();
    });

    it('highlights selected initiative tab', () => {
      const initiatives = [
        createMockInitiative({ initiative_id: 'init-1', name: 'Q1 Launch' }),
        createMockInitiative({ initiative_id: 'init-2', name: 'Q2 Release' }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId="init-1" onSelect={mockOnSelect} />);

      const selectedTab = screen.getByRole('tab', { selected: true });
      expect(selectedTab).toHaveTextContent('Q1 Launch');
      expect(selectedTab).toHaveClass('bg-bg-elevated', 'text-text-primary', 'shadow-sm');
    });

    it('calls onSelect with initiative_id when initiative tab is clicked', async () => {
      const user = userEvent.setup();
      const initiatives = [
        createMockInitiative({ initiative_id: 'init-1', name: 'Q1 Launch' }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const initiativeTab = screen.getByText('Q1 Launch');
      await user.click(initiativeTab);

      expect(mockOnSelect).toHaveBeenCalledWith('init-1');
    });

    it('uses default color when initiative color is undefined', () => {
      const initiatives = [
        createMockInitiative({
          initiative_id: 'init-1',
          name: 'Q1 Launch',
          color: undefined,
        }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const dot = container.querySelector('.w-1\\.5.h-1\\.5.rounded-full');
      expect(dot).toHaveStyle({ backgroundColor: '#a855f7' });
    });

    it('truncates long initiative names', () => {
      const initiatives = [
        createMockInitiative({
          initiative_id: 'init-1',
          name: 'Very Long Initiative Name That Should Be Truncated',
        }),
      ];

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const nameElement = container.querySelector('.truncate.max-w-\\[120px\\]');
      expect(nameElement).toBeInTheDocument();
    });
  });

  describe('New Initiative button', () => {
    it('renders "New" button at the end', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const newButton = screen.getByRole('button', { name: /create new initiative/i });
      expect(newButton).toHaveTextContent('New');
    });

    it('renders plus icon in New button', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const newButton = screen.getByRole('button', { name: /create new initiative/i });
      const svg = newButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('does nothing when New button is clicked (placeholder)', async () => {
      const user = userEvent.setup();

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const newButton = screen.getByRole('button', { name: /create new initiative/i });

      // Should not throw - button is a placeholder for future functionality
      await expect(user.click(newButton)).resolves.not.toThrow();
    });
  });

  describe('accessibility', () => {
    it('provides tablist role to container', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('provides aria-label for tablist', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveAttribute('aria-label', 'Filter plans by initiative');
    });

    it('sets aria-selected on tabs', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative({ initiative_id: 'init-1' })],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId="init-1" onSelect={mockOnSelect} />);

      const tabs = screen.getAllByRole('tab');
      const selectedTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
      expect(selectedTab).toBeInTheDocument();
    });

    it('hides color dots from screen readers', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const dot = container.querySelector('.w-1\\.5.h-1\\.5.rounded-full');
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });

    it('provides role="img" for initiative icons', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative({ icon: '🚀' })],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const icon = screen.getByRole('img', { name: /initiative icon/i });
      expect(icon).toHaveTextContent('🚀');
    });
  });

  describe('layout and styling', () => {
    it('applies horizontal scrolling classes', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const tablist = container.querySelector('.overflow-x-auto');
      expect(tablist).toHaveClass('flex', 'gap-2', 'scrollbar-hide');
    });

    it('applies custom className', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { container } = render(
        <InitiativeTabs selectedId={null} onSelect={mockOnSelect} className="custom-class" />
      );

      const tablist = container.querySelector('.custom-class');
      expect(tablist).toBeInTheDocument();
    });

    it('applies flex-shrink-0 to prevent tab squashing', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      const allTab = screen.getByText('All');
      expect(allTab).toHaveClass('flex-shrink-0');
    });
  });

  describe('empty state', () => {
    it('renders only "All" and "New" when no initiatives exist', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      render(<InitiativeTabs selectedId={null} onSelect={mockOnSelect} />);

      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getAllByRole('tab')).toHaveLength(1); // Only "All" is a tab
    });
  });
});
