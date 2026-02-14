import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusMode, type FocusModeBlock } from '../FocusMode';

/**
 * FocusMode Component Tests
 *
 * Verifies:
 * - Block metadata display (emoji, keyword, title, type, confidence, status, specialist)
 * - Content rendering
 * - Close button functionality
 * - Curate button functionality
 * - Children slot rendering (contextual chat)
 */

describe('FocusMode', () => {
  const mockBlock: FocusModeBlock = {
    id: 'block-1',
    emoji: '💡',
    keyword: 'Feature',
    confidence: 85,
    status: 'ready',
    type: 'feature',
    title: 'User authentication system',
    content: '## Overview\n\nImplement OAuth-based authentication...',
    specialist: 'Architect',
    sourceContext: 'Discussed in meeting on 2024-01-15',
    userEdited: false,
    userEdits: [],
  };

  const mockOnClose = vi.fn();
  const mockOnCurate = vi.fn();

  it('renders block metadata correctly', () => {
    render(
      <FocusMode block={mockBlock} onClose={mockOnClose} onCurate={mockOnCurate} />
    );

    // Check emoji and keyword
    expect(screen.getByText('💡')).toBeInTheDocument();
    expect(screen.getByText('Feature')).toBeInTheDocument();

    // Check title
    expect(screen.getByText('User authentication system')).toBeInTheDocument();

    // Check metadata fields
    expect(screen.getByText('feature')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('Architect')).toBeInTheDocument();
  });

  it('renders block content', () => {
    render(
      <FocusMode block={mockBlock} onClose={mockOnClose} onCurate={mockOnCurate} />
    );

    expect(screen.getByText(/OAuth-based authentication/)).toBeInTheDocument();
  });

  it('renders source context when present', () => {
    render(
      <FocusMode block={mockBlock} onClose={mockOnClose} onCurate={mockOnCurate} />
    );

    expect(screen.getByText('Discussed in meeting on 2024-01-15')).toBeInTheDocument();
  });

  it('does not render source context when absent', () => {
    const blockWithoutContext = { ...mockBlock, sourceContext: undefined };
    render(
      <FocusMode block={blockWithoutContext} onClose={mockOnClose} onCurate={mockOnCurate} />
    );

    expect(screen.queryByText('Source Context')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <FocusMode block={mockBlock} onClose={mockOnClose} onCurate={mockOnCurate} />
    );

    const closeButton = screen.getByLabelText('Close focus mode');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onCurate when curate button is clicked', () => {
    render(
      <FocusMode block={mockBlock} onClose={mockOnClose} onCurate={mockOnCurate} />
    );

    const curateButton = screen.getByLabelText('Curate block');
    fireEvent.click(curateButton);

    expect(mockOnCurate).toHaveBeenCalledTimes(1);
  });

  it('renders children in the chat slot', () => {
    render(
      <FocusMode block={mockBlock} onClose={mockOnClose} onCurate={mockOnCurate}>
        <div data-testid="chat-slot">Chat UI goes here</div>
      </FocusMode>
    );

    expect(screen.getByTestId('chat-slot')).toBeInTheDocument();
    expect(screen.getByText('Chat UI goes here')).toBeInTheDocument();
  });

  it('shows user edits count when present', () => {
    const blockWithEdits: FocusModeBlock = {
      ...mockBlock,
      userEdited: true,
      userEdits: [
        { id: '1', range: { start: 0, end: 10 }, content: 'Edit 1', timestamp: '2024-01-15T10:00:00Z' },
        { id: '2', range: { start: 10, end: 20 }, content: 'Edit 2', timestamp: '2024-01-15T11:00:00Z' },
      ],
    };

    render(
      <FocusMode block={blockWithEdits} onClose={mockOnClose} onCurate={mockOnCurate} />
    );

    expect(screen.getByText('User Edits')).toBeInTheDocument();
    expect(screen.getByText('2 edits made')).toBeInTheDocument();
  });

  it('does not show user edits section when no edits exist', () => {
    render(
      <FocusMode block={mockBlock} onClose={mockOnClose} onCurate={mockOnCurate} />
    );

    expect(screen.queryByText('User Edits')).not.toBeInTheDocument();
  });

  it('handles blocks with minimal data gracefully', () => {
    const minimalBlock: FocusModeBlock = {
      id: 'block-minimal',
      emoji: '🔧',
      keyword: 'Tool',
      confidence: 50,
      status: 'forming',
    };

    render(
      <FocusMode block={minimalBlock} onClose={mockOnClose} onCurate={mockOnCurate} />
    );

    // Should still render essential fields
    expect(screen.getByText('🔧')).toBeInTheDocument();
    expect(screen.getByText('Tool')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('forming')).toBeInTheDocument();

    // Should show "No content yet..." for empty content
    expect(screen.getByText('No content yet...')).toBeInTheDocument();
  });
});
