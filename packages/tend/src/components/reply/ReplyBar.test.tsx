/**
 * ReplyBar Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplyBar } from './ReplyBar';
import type { ReplyItem } from '@/hooks/useQuestionQueue';

describe('ReplyBar', () => {
  const mockItems: ReplyItem[] = [
    {
      id: 'item-1',
      type: 'question',
      preview: 'Should we use TypeScript?',
      agentRole: 'architect',
      priority: 'high',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      id: 'item-2',
      type: 'approval',
      preview: 'Ready to merge PR #42',
      agentRole: 'coder',
      priority: 'medium',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
  ];

  it('renders nothing when items array is empty', () => {
    const { container } = render(<ReplyBar items={[]} onItemClick={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all items when count is 3 or less', () => {
    render(<ReplyBar items={mockItems} onItemClick={vi.fn()} />);
    expect(screen.getByText(/Should we use TypeScript/)).toBeInTheDocument();
    expect(screen.getByText(/Ready to merge PR #42/)).toBeInTheDocument();
  });

  it('shows overflow indicator when more than 3 items', () => {
    const manyItems: ReplyItem[] = [
      ...mockItems,
      {
        id: 'item-3',
        type: 'review',
        preview: 'Review needed',
        priority: 'low',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'item-4',
        type: 'question',
        preview: 'Another question',
        priority: 'medium',
        timestamp: new Date().toISOString(),
      },
    ];

    render(<ReplyBar items={manyItems} onItemClick={vi.fn()} />);
    expect(screen.getByText(/\+1 more pending/)).toBeInTheDocument();
  });

  it('calls onItemClick when item is clicked', () => {
    const handleClick = vi.fn();
    render(<ReplyBar items={mockItems} onItemClick={handleClick} />);

    const firstItem = screen.getByText(/Should we use TypeScript/).closest('button');
    expect(firstItem).toBeInTheDocument();

    if (firstItem) {
      fireEvent.click(firstItem);
      expect(handleClick).toHaveBeenCalledWith('item-1');
    }
  });

  it('displays agent role when provided', () => {
    render(<ReplyBar items={mockItems} onItemClick={vi.fn()} />);
    expect(screen.getByText('architect')).toBeInTheDocument();
    expect(screen.getByText('coder')).toBeInTheDocument();
  });

  it('displays time ago for each item', () => {
    render(<ReplyBar items={mockItems} onItemClick={vi.fn()} />);
    // Should show relative time like "5 minutes ago", "15 minutes ago"
    const timeElements = screen.getAllByText(/ago/);
    expect(timeElements.length).toBeGreaterThanOrEqual(2);
  });
});
