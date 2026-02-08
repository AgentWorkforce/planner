import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockDetailPanel } from '../BlockDetailPanel';
import type { Block } from '../BlockDetailPanel';

describe('BlockDetailPanel', () => {
  const mockBlock: Block = {
    id: 'test-block-1',
    emoji: '💡',
    keyword: 'Auth Flow',
    confidence: 75,
    status: 'developing',
    type: 'feature',
    title: 'User Authentication',
    content: '**What**: User authentication\n**Why**: Secure access needed',
    specialist: 'Architect',
    sourceContext: 'Turn 3',
  };

  it('renders block metadata correctly', () => {
    render(<BlockDetailPanel block={mockBlock} />);

    expect(screen.getByText('💡')).toBeInTheDocument();
    expect(screen.getByText('Auth Flow')).toBeInTheDocument();
    expect(screen.getByText('Type: feature')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('displays content in textarea', () => {
    render(<BlockDetailPanel block={mockBlock} />);

    const textarea = screen.getByPlaceholderText(/Enter block content/i);
    expect(textarea).toHaveValue(mockBlock.content);
  });

  it('calls onContentChange when content is edited', () => {
    const handleContentChange = vi.fn();
    render(<BlockDetailPanel block={mockBlock} onContentChange={handleContentChange} />);

    const textarea = screen.getByPlaceholderText(/Enter block content/i);
    fireEvent.change(textarea, { target: { value: 'New content' } });

    expect(handleContentChange).toHaveBeenCalledWith('New content');
  });

  it('shows curate button for non-curated blocks', () => {
    const handleCurate = vi.fn();
    render(<BlockDetailPanel block={mockBlock} onCurate={handleCurate} />);

    const curateButton = screen.getByRole('button', { name: /curate block/i });
    expect(curateButton).toBeInTheDocument();
  });

  it('hides curate button for curated blocks', () => {
    const curatedBlock = { ...mockBlock, status: 'curated' };
    const handleCurate = vi.fn();
    render(<BlockDetailPanel block={curatedBlock} onCurate={handleCurate} />);

    const curateButton = screen.queryByRole('button', { name: /curate block/i });
    expect(curateButton).not.toBeInTheDocument();
  });

  it('calls onCurate when curate button is clicked', () => {
    const handleCurate = vi.fn();
    render(<BlockDetailPanel block={mockBlock} onCurate={handleCurate} />);

    const curateButton = screen.getByRole('button', { name: /curate block/i });
    fireEvent.click(curateButton);

    expect(handleCurate).toHaveBeenCalled();
  });

  it('shows delete confirmation dialog when delete is clicked', () => {
    const handleDelete = vi.fn();
    render(<BlockDetailPanel block={mockBlock} onDelete={handleDelete} />);

    const deleteButton = screen.getByRole('button', { name: /delete block/i });
    fireEvent.click(deleteButton);

    expect(screen.getByText('Delete Block')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
  });

  it('calls onDelete when deletion is confirmed', () => {
    const handleDelete = vi.fn();
    render(<BlockDetailPanel block={mockBlock} onDelete={handleDelete} />);

    // Open confirmation dialog
    const deleteButton = screen.getByRole('button', { name: /delete block/i });
    fireEvent.click(deleteButton);

    // Confirm deletion - find button by text content
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    expect(handleDelete).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<BlockDetailPanel block={mockBlock} onClose={handleClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalled();
  });

  it('displays source context when available', () => {
    render(<BlockDetailPanel block={mockBlock} />);

    expect(screen.getByText(/Source:/i)).toBeInTheDocument();
    expect(screen.getByText(/Architect, Turn 3/i)).toBeInTheDocument();
  });

  it('does not show source context when not available', () => {
    const blockWithoutSource = { ...mockBlock, specialist: undefined, sourceContext: undefined };
    render(<BlockDetailPanel block={blockWithoutSource} />);

    expect(screen.queryByText(/Source:/i)).not.toBeInTheDocument();
  });

  it('renders confidence bar with correct width', () => {
    const { container } = render(<BlockDetailPanel block={mockBlock} />);

    const progressBar = container.querySelector('[aria-label="75% confidence"]');
    expect(progressBar).toHaveStyle({ width: '75%' });
  });
});
