import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewModeToggle } from './ViewModeToggle';

describe('ViewModeToggle', () => {
  it('renders list and swimlane buttons', () => {
    render(<ViewModeToggle value="list" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /swimlane/i })).toBeInTheDocument();
  });

  it('shows list button as active when value is list', () => {
    render(<ViewModeToggle value="list" onChange={vi.fn()} />);

    const listButton = screen.getByRole('button', { name: /list/i });
    expect(listButton).toHaveClass('active');
  });

  it('shows swimlane button as active when value is swimlane', () => {
    render(<ViewModeToggle value="swimlane" onChange={vi.fn()} />);

    const swimlaneButton = screen.getByRole('button', { name: /swimlane/i });
    expect(swimlaneButton).toHaveClass('active');
  });

  it('calls onChange with "list" when list button clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ViewModeToggle value="swimlane" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /list/i }));

    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('calls onChange with "swimlane" when swimlane button clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ViewModeToggle value="list" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /swimlane/i }));

    expect(onChange).toHaveBeenCalledWith('swimlane');
  });

  it('renders SVG icons for each mode', () => {
    render(<ViewModeToggle value="list" onChange={vi.fn()} />);

    // Both buttons should contain SVG elements
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button.querySelector('svg')).toBeInTheDocument();
    });
  });

  it('has accessible titles for buttons', () => {
    render(<ViewModeToggle value="list" onChange={vi.fn()} />);

    expect(screen.getByTitle('List View')).toBeInTheDocument();
    expect(screen.getByTitle('Swimlane View')).toBeInTheDocument();
  });
});
