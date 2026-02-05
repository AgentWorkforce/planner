import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CanvasLayout } from '../CanvasLayout';

describe('CanvasLayout', () => {
  it('renders all three column slots', () => {
    render(
      <CanvasLayout
        formingBlocksSlot={<div data-testid="forming-blocks">Forming</div>}
        chatSlot={<div data-testid="chat">Chat</div>}
        curatedBlocksSlot={<div data-testid="curated-blocks">Curated</div>}
      />
    );

    expect(screen.getByTestId('forming-blocks')).toBeInTheDocument();
    expect(screen.getByTestId('chat')).toBeInTheDocument();
    expect(screen.getByTestId('curated-blocks')).toBeInTheDocument();
  });

  it('applies correct flex proportions to columns', () => {
    const { container } = render(
      <CanvasLayout
        formingBlocksSlot={<div>Forming</div>}
        chatSlot={<div>Chat</div>}
        curatedBlocksSlot={<div>Curated</div>}
      />
    );

    const parentDiv = container.firstChild as HTMLElement;
    const columns = Array.from(parentDiv.children) as HTMLElement[];

    // Left column (30%)
    expect(columns[0]).toHaveClass('flex-[0_0_30%]');

    // Center column (45%)
    expect(columns[1]).toHaveClass('flex-[0_0_45%]');

    // Right column (25%)
    expect(columns[2]).toHaveClass('flex-[0_0_25%]');
  });

  it('applies full height to container and columns', () => {
    const { container } = render(
      <CanvasLayout
        formingBlocksSlot={<div>Forming</div>}
        chatSlot={<div>Chat</div>}
        curatedBlocksSlot={<div>Curated</div>}
      />
    );

    // Container has h-full
    expect(container.firstChild).toHaveClass('h-full');

    // All columns have h-full
    const parentDiv = container.firstChild as HTMLElement;
    const columns = Array.from(parentDiv.children) as HTMLElement[];
    columns.forEach(column => {
      expect(column).toHaveClass('h-full');
    });
  });

  it('applies correct background colors to columns', () => {
    const { container } = render(
      <CanvasLayout
        formingBlocksSlot={<div>Forming</div>}
        chatSlot={<div>Chat</div>}
        curatedBlocksSlot={<div>Curated</div>}
      />
    );

    const parentDiv = container.firstChild as HTMLElement;
    const columns = Array.from(parentDiv.children) as HTMLElement[];

    // Left column (forming blocks)
    expect(columns[0]).toHaveClass('bg-bg-tertiary');

    // Center column (chat)
    expect(columns[1]).toHaveClass('bg-bg-primary');

    // Right column (curated blocks)
    expect(columns[2]).toHaveClass('bg-bg-secondary');
  });

  it('applies borders to left and right columns', () => {
    const { container } = render(
      <CanvasLayout
        formingBlocksSlot={<div>Forming</div>}
        chatSlot={<div>Chat</div>}
        curatedBlocksSlot={<div>Curated</div>}
      />
    );

    const parentDiv = container.firstChild as HTMLElement;
    const columns = Array.from(parentDiv.children) as HTMLElement[];

    // Left column has right border
    expect(columns[0]).toHaveClass('border-r', 'border-border-subtle');

    // Center column has no explicit border classes
    expect(columns[1]).not.toHaveClass('border-r');
    expect(columns[1]).not.toHaveClass('border-l');

    // Right column has left border
    expect(columns[2]).toHaveClass('border-l', 'border-border-subtle');
  });

  it('accepts and applies custom className', () => {
    const { container } = render(
      <CanvasLayout
        formingBlocksSlot={<div>Forming</div>}
        chatSlot={<div>Chat</div>}
        curatedBlocksSlot={<div>Curated</div>}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('applies overflow-hidden to all columns', () => {
    const { container } = render(
      <CanvasLayout
        formingBlocksSlot={<div>Forming</div>}
        chatSlot={<div>Chat</div>}
        curatedBlocksSlot={<div>Curated</div>}
      />
    );

    const parentDiv = container.firstChild as HTMLElement;
    const columns = Array.from(parentDiv.children) as HTMLElement[];
    columns.forEach(column => {
      expect(column).toHaveClass('overflow-hidden');
    });
  });
});
