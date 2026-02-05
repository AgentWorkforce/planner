/**
 * CuratedBlocksColumn Integration Tests
 *
 * Tests for the curated blocks column component and un-curate action.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CuratedBlocksColumn } from '../CuratedBlocksColumn';
import type { Block } from '../FormingBlocksColumn';

describe('CuratedBlocksColumn', () => {
  const mockBlocks: Block[] = [
    {
      id: 'block-1',
      type: 'problem',
      title: 'Test Block 1',
      keyword: 'authentication',
      emoji: '🔐',
      content: 'Users need secure login',
      specialist: 'problem-finder',
      sourceContext: 'user-message-1',
      confidence: 85,
      status: 'curated',
      createdAt: '2024-01-01T00:00:00Z',
      curatedAt: '2024-01-01T00:10:00Z',
    },
    {
      id: 'block-2',
      type: 'solution',
      title: 'Test Block 2',
      keyword: 'oauth',
      emoji: '🎫',
      content: 'Use OAuth 2.0 flow',
      specialist: 'solution-architect',
      sourceContext: 'user-message-2',
      confidence: 90,
      status: 'curated',
      createdAt: '2024-01-01T00:05:00Z',
      curatedAt: '2024-01-01T00:15:00Z',
    },
    {
      id: 'block-3',
      type: 'problem',
      title: 'Test Block 3',
      keyword: 'performance',
      emoji: '⚡',
      content: 'API is slow',
      specialist: 'problem-finder',
      sourceContext: 'user-message-3',
      confidence: 75,
      status: 'ready',
      createdAt: '2024-01-01T00:03:00Z',
    },
  ];

  describe('Rendering', () => {
    it('should render curated blocks only', () => {
      render(<CuratedBlocksColumn blocks={mockBlocks} />);

      // Should show curated blocks
      expect(screen.getByText('authentication')).toBeInTheDocument();
      expect(screen.getByText('oauth')).toBeInTheDocument();

      // Should not show ready blocks
      expect(screen.queryByText('performance')).not.toBeInTheDocument();
    });

    it('should show correct count', () => {
      render(<CuratedBlocksColumn blocks={mockBlocks} />);
      expect(screen.getByText(/Curated \(2\)/i)).toBeInTheDocument();
    });

    it('should show empty state when no curated blocks', () => {
      const nonCuratedBlocks: Block[] = [
        {
          ...mockBlocks[2]!,
          status: 'ready',
        },
      ];

      render(<CuratedBlocksColumn blocks={nonCuratedBlocks} />);
      expect(screen.getByText(/No curated blocks yet/i)).toBeInTheDocument();
    });
  });

  describe('Uncurate Action', () => {
    it('should call onUncurate when uncurate button is clicked', () => {
      const mockOnUncurate = vi.fn();
      render(<CuratedBlocksColumn blocks={mockBlocks} onUncurate={mockOnUncurate} />);

      const uncurateButtons = screen.getAllByRole('button', { name: /uncurate/i });
      fireEvent.click(uncurateButtons[0]!);

      expect(mockOnUncurate).toHaveBeenCalledWith('block-1');
    });

    it('should not show uncurate button when onUncurate is not provided', () => {
      const { container } = render(<CuratedBlocksColumn blocks={mockBlocks} />);

      // There should be no uncurate buttons when onUncurate prop is not provided
      const buttonsByTitle = container.querySelectorAll('button[title="Move back to forming"]');
      const buttonsByAriaLabel = container.querySelectorAll('button[aria-label="Uncurate block"]');

      expect(buttonsByTitle.length).toBe(0);
      expect(buttonsByAriaLabel.length).toBe(0);
    });

    it('should stop propagation when uncurate button is clicked', () => {
      const mockOnBlockClick = vi.fn();
      const mockOnUncurate = vi.fn();

      render(
        <CuratedBlocksColumn
          blocks={mockBlocks}
          onBlockClick={mockOnBlockClick}
          onUncurate={mockOnUncurate}
        />
      );

      const uncurateButtons = screen.getAllByRole('button', { name: /uncurate/i });
      fireEvent.click(uncurateButtons[0]!);

      // Should call uncurate but not block click
      expect(mockOnUncurate).toHaveBeenCalledWith('block-1');
      expect(mockOnBlockClick).not.toHaveBeenCalled();
    });
  });

  describe('Interactions', () => {
    it('should call onBlockClick when block card is clicked', () => {
      const mockOnBlockClick = vi.fn();
      render(<CuratedBlocksColumn blocks={mockBlocks} onBlockClick={mockOnBlockClick} />);

      // Click on the first block card (not the uncurate button)
      const blockCard = screen.getByText('authentication').closest('div');
      fireEvent.click(blockCard!);

      expect(mockOnBlockClick).toHaveBeenCalledWith('block-1');
    });
  });

  describe('Visual Design', () => {
    it('should display emoji, keyword, and confidence for each block', () => {
      render(<CuratedBlocksColumn blocks={mockBlocks} />);

      // Check first block
      expect(screen.getByText('🔐')).toBeInTheDocument();
      expect(screen.getByText('authentication')).toBeInTheDocument();
      expect(screen.getByText(/85% confidence/i)).toBeInTheDocument();

      // Check second block
      expect(screen.getByText('🎫')).toBeInTheDocument();
      expect(screen.getByText('oauth')).toBeInTheDocument();
      expect(screen.getByText(/90% confidence/i)).toBeInTheDocument();
    });

    it('should apply green border styling to curated blocks', () => {
      const { container } = render(<CuratedBlocksColumn blocks={mockBlocks} />);

      // Find block cards with green border
      const blockCards = container.querySelectorAll('[style*="--block-curated-border"]');
      expect(blockCards.length).toBe(2);
    });
  });
});
