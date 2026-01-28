import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableText } from './EditableText';

describe('EditableText', () => {
  it('renders the value in view mode', () => {
    render(<EditableText value="Test Value" onSave={vi.fn()} />);

    expect(screen.getByText('Test Value')).toBeInTheDocument();
  });

  it('shows placeholder when value is empty', () => {
    render(<EditableText value="" onSave={vi.fn()} placeholder="Click to edit" />);

    expect(screen.getByText('Click to edit')).toBeInTheDocument();
  });

  it('enters edit mode on click', async () => {
    const user = userEvent.setup();
    render(<EditableText value="Test Value" onSave={vi.fn()} />);

    await user.click(screen.getByText('Test Value'));

    expect(screen.getByRole('textbox')).toHaveValue('Test Value');
  });

  it('enters edit mode on Enter key', async () => {
    const user = userEvent.setup();
    render(<EditableText value="Test Value" onSave={vi.fn()} />);

    const element = screen.getByRole('button');
    element.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('textbox')).toHaveValue('Test Value');
  });

  it('saves on Enter key', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<EditableText value="Test Value" onSave={onSave} />);

    await user.click(screen.getByText('Test Value'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'New Value');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('New Value');
    });
  });

  it('cancels on Escape key', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<EditableText value="Test Value" onSave={onSave} />);

    await user.click(screen.getByText('Test Value'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'New Value');
    await user.keyboard('{Escape}');

    expect(screen.getByText('Test Value')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves on blur', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <div>
        <EditableText value="Test Value" onSave={onSave} />
        <button>Other element</button>
      </div>
    );

    await user.click(screen.getByText('Test Value'));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'New Value');
    await user.click(screen.getByRole('button', { name: 'Other element' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('New Value');
    });
  });

  it('does not enter edit mode when disabled', async () => {
    const user = userEvent.setup();
    render(<EditableText value="Test Value" onSave={vi.fn()} disabled />);

    await user.click(screen.getByText('Test Value'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('does not call onSave if value has not changed', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(<EditableText value="Test Value" onSave={onSave} />);

    await user.click(screen.getByText('Test Value'));
    await user.keyboard('{Enter}');

    expect(onSave).not.toHaveBeenCalled();
  });
});
