import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PipelineToolbar } from '../PipelineToolbar';
import type { Initiative } from '@/types';

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

describe('PipelineToolbar', () => {
  const mockOnSelectInitiative = vi.fn();
  const mockOnViewModeChange = vi.fn();
  const mockOnNewPlan = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for useInitiatives
    vi.mocked(useInitiatives).mockReturnValue({
      initiatives: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  describe('two-row layout', () => {
    it('renders two-row structure', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const { container } = renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      // Check for border-b which separates rows
      const rows = container.querySelectorAll('.border-b.border-border-subtle');
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('applies correct height to rows', () => {
      const { container } = renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const rows = container.querySelectorAll('.h-12');
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('row 1: title and New Plan button', () => {
    it('renders "Pipeline" title', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const title = screen.getByRole('heading', { name: 'Pipeline' });
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass('font-display', 'text-lg', 'font-semibold');
    });

    it('renders New Plan button', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const button = screen.getByRole('link', { name: /new plan/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('href', '/plans/new');
    });

    it('renders plus icon in New Plan button', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const button = screen.getByRole('link', { name: /new plan/i });
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('calls onNewPlan when provided', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
          onNewPlan={mockOnNewPlan}
        />
      );

      const button = screen.getByRole('link', { name: /new plan/i });
      await user.click(button);

      expect(mockOnNewPlan).toHaveBeenCalled();
    });
  });

  describe('row 2: initiative tabs', () => {
    it('renders InitiativeTabs component', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      // InitiativeTabs should render "All" tab
      expect(screen.getByText('All')).toBeInTheDocument();
    });

    it('passes selectedInitiative to InitiativeTabs', () => {
      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative({ initiative_id: 'init-1', name: 'Q1 Launch' })],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderWithRouter(
        <PipelineToolbar
          selectedInitiative="init-1"
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const selectedTab = screen.getByRole('tab', { selected: true });
      expect(selectedTab).toHaveTextContent('Q1 Launch');
    });

    it('calls onSelectInitiative when initiative tab clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative({ initiative_id: 'init-1', name: 'Q1 Launch' })],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const initiativeTab = screen.getByText('Q1 Launch');
      await user.click(initiativeTab);

      expect(mockOnSelectInitiative).toHaveBeenCalledWith('init-1');
    });

    it('calls onSelectInitiative with null when All tab clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(useInitiatives).mockReturnValue({
        initiatives: [createMockInitiative()],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderWithRouter(
        <PipelineToolbar
          selectedInitiative="init-1"
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const allTab = screen.getByText('All');
      await user.click(allTab);

      expect(mockOnSelectInitiative).toHaveBeenCalledWith(null);
    });
  });

  describe('row 2: view mode toggle', () => {
    it('renders view mode toggle', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const sequenceButton = screen.getByRole('radio', { name: /sequence view/i });
      const boardButton = screen.getByRole('radio', { name: /board view/i });

      expect(sequenceButton).toBeInTheDocument();
      expect(boardButton).toBeInTheDocument();
    });

    it('shows sequence view as selected when viewMode is "sequence"', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const sequenceButton = screen.getByRole('radio', { name: /sequence view/i });
      expect(sequenceButton).toHaveAttribute('data-state', 'on');
    });

    it('shows board view as selected when viewMode is "board"', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="board"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const boardButton = screen.getByRole('radio', { name: /board view/i });
      expect(boardButton).toHaveAttribute('data-state', 'on');
    });

    it('calls onViewModeChange when sequence button clicked', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="board"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const sequenceButton = screen.getByRole('radio', { name: /sequence view/i });
      await user.click(sequenceButton);

      expect(mockOnViewModeChange).toHaveBeenCalledWith('sequence');
    });

    it('calls onViewModeChange when board button clicked', async () => {
      const user = userEvent.setup();

      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const boardButton = screen.getByRole('radio', { name: /board view/i });
      await user.click(boardButton);

      expect(mockOnViewModeChange).toHaveBeenCalledWith('board');
    });

    it('renders icons in view mode toggle', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const sequenceButton = screen.getByRole('radio', { name: /sequence view/i });
      const boardButton = screen.getByRole('radio', { name: /board view/i });

      const sequenceIcon = sequenceButton.querySelector('svg');
      const boardIcon = boardButton.querySelector('svg');

      expect(sequenceIcon).toBeInTheDocument();
      expect(boardIcon).toBeInTheDocument();
    });
  });

  describe('layout and styling', () => {
    it('applies flex layout with space between for row 1', () => {
      const { container } = renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const row1 = container.querySelector('.flex.items-center.justify-between.h-12.px-4');
      expect(row1).toBeInTheDocument();
    });

    it('applies flex layout with space between for row 2', () => {
      const { container } = renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const rows = container.querySelectorAll(
        '.flex.items-center.justify-between.h-12.px-4.gap-4'
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('applies border to container', () => {
      const { container } = renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const toolbar = container.querySelector('.border-b.border-border-subtle');
      expect(toolbar).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('provides aria-label for view mode toggle', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const toggleGroup = screen.getByRole('group', { name: /view mode/i });
      expect(toggleGroup).toBeInTheDocument();
    });

    it('provides aria-label for sequence view button', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const sequenceButton = screen.getByRole('radio', { name: /sequence view/i });
      expect(sequenceButton).toHaveAttribute('aria-label', 'Sequence view');
    });

    it('provides aria-label for board view button', () => {
      renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const boardButton = screen.getByRole('radio', { name: /board view/i });
      expect(boardButton).toHaveAttribute('aria-label', 'Board view');
    });
  });

  describe('responsive behavior', () => {
    it('applies flex-shrink-0 to view toggle to prevent squashing', () => {
      const { container } = renderWithRouter(
        <PipelineToolbar
          selectedInitiative={null}
          onSelectInitiative={mockOnSelectInitiative}
          viewMode="sequence"
          onViewModeChange={mockOnViewModeChange}
        />
      );

      const viewToggleContainer = container.querySelector('.flex-shrink-0');
      expect(viewToggleContainer).toBeInTheDocument();
    });
  });
});
