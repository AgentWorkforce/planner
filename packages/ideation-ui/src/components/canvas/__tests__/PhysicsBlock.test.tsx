import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhysicsBlock, type PhysicsBlockProps } from '../PhysicsBlock';

describe('PhysicsBlock', () => {
  const mockBlock: PhysicsBlockProps['block'] = {
    id: 'test-block',
    emoji: '💡',
    keyword: 'Idea',
    confidence: 75,
    status: 'developing',
  };

  const defaultProps: PhysicsBlockProps = {
    block: mockBlock,
    position: { x: 100, y: 100 },
    size: 60,
  };

  it('renders emoji for non-forming blocks', () => {
    render(<PhysicsBlock {...defaultProps} />);
    expect(screen.getByText('💡')).toBeInTheDocument();
  });

  it('renders keyword when size permits and not forming', () => {
    render(<PhysicsBlock {...defaultProps} size={65} />);
    expect(screen.getByText('Idea')).toBeInTheDocument();
  });

  it('does not render keyword when size is too small', () => {
    render(<PhysicsBlock {...defaultProps} size={40} />);
    expect(screen.queryByText('Idea')).not.toBeInTheDocument();
  });

  it('renders tiny dot for forming blocks', () => {
    const formingBlock = { ...mockBlock, status: 'forming' as const };
    render(<PhysicsBlock {...defaultProps} block={formingBlock} />);
    expect(screen.queryByText('💡')).not.toBeInTheDocument();
    expect(screen.queryByText('Idea')).not.toBeInTheDocument();
  });

  it('calls onDragStart when mouse down', () => {
    const onDragStart = vi.fn();
    const { container } = render(
      <PhysicsBlock {...defaultProps} onDragStart={onDragStart} />,
    );
    const block = container.firstChild as HTMLElement;
    fireEvent.mouseDown(block);
    expect(onDragStart).toHaveBeenCalledOnce();
  });

  it('calls onDragEnd when mouse up after dragging', () => {
    const onDragEnd = vi.fn();
    const { container } = render(
      <PhysicsBlock {...defaultProps} onDragEnd={onDragEnd} />,
    );
    const block = container.firstChild as HTMLElement;
    fireEvent.mouseDown(block);
    fireEvent.mouseUp(block);
    expect(onDragEnd).toHaveBeenCalledOnce();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = render(
      <PhysicsBlock {...defaultProps} onClick={onClick} />,
    );
    const block = container.firstChild as HTMLElement;
    fireEvent.click(block);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies correct opacity based on confidence', () => {
    const lowConfidenceBlock = { ...mockBlock, confidence: 20 };
    const { container } = render(
      <PhysicsBlock {...defaultProps} block={lowConfidenceBlock} />,
    );
    const block = container.firstChild as HTMLElement;
    // Min opacity is 0.3
    expect(block.style.opacity).toBe('0.3');
  });

  it('applies correct size', () => {
    const { container } = render(<PhysicsBlock {...defaultProps} size={80} />);
    const block = container.firstChild as HTMLElement;
    expect(block.style.width).toBe('80px');
    expect(block.style.height).toBe('80px');
  });

  it('shows glow for ready blocks with high confidence', () => {
    const readyBlock = { ...mockBlock, status: 'ready' as const, confidence: 95 };
    const { container } = render(
      <PhysicsBlock {...defaultProps} block={readyBlock} />,
    );
    const block = container.firstChild as HTMLElement;
    expect(block.className).toContain('animate-pulse');
    expect(block.style.boxShadow).toContain('hsl');
  });

  it('does not show glow for ready blocks with low confidence', () => {
    const readyBlock = { ...mockBlock, status: 'ready' as const, confidence: 85 };
    const { container } = render(
      <PhysicsBlock {...defaultProps} block={readyBlock} />,
    );
    const block = container.firstChild as HTMLElement;
    expect(block.className).not.toContain('animate-pulse');
  });
});
