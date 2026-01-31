import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconPicker } from '../IconPicker';

const PRESET_EMOJIS = [
  '🚀', '🎯', '🚩', '⭐', '⚡', '📁',
  '💼', '📊', '🔧', '📝', '💡', '🎨',
  '📈', '🏆', '🌟', '📦',
];

describe('IconPicker', () => {
  it('renders preset emoji grid with 16 emojis', () => {
    render(<IconPicker value="🚀" onChange={vi.fn()} />);

    const radioGroup = screen.getByRole('radiogroup', { name: 'Select an icon' });
    expect(radioGroup).toBeInTheDocument();

    PRESET_EMOJIS.forEach((emoji) => {
      const button = screen.getByRole('radio', { name: emoji });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(emoji);
    });
  });

  it('highlights selected emoji with accent styles', () => {
    render(<IconPicker value="🎯" onChange={vi.fn()} />);

    const selectedEmoji = screen.getByRole('radio', { name: '🎯' });
    const unselectedEmoji = screen.getByRole('radio', { name: '🚀' });

    expect(selectedEmoji).toHaveAttribute('aria-checked', 'true');
    expect(selectedEmoji).toHaveClass('bg-accent-cyan/10', 'border-accent-cyan');
    expect(unselectedEmoji).toHaveAttribute('aria-checked', 'false');
    expect(unselectedEmoji).not.toHaveClass('bg-accent-cyan/10');
  });

  it('calls onChange when preset emoji is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="🚀" onChange={onChange} />);

    const targetEmoji = screen.getByRole('radio', { name: '🎯' });
    await user.click(targetEmoji);

    expect(onChange).toHaveBeenCalledWith('🎯');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('renders custom emoji input field', () => {
    render(<IconPicker value="🚀" onChange={vi.fn()} />);

    const input = screen.getByLabelText('Custom emoji input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Type any emoji...');
    expect(input).toHaveAttribute('maxLength', '4');
  });

  it('calls onChange when typing in custom input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="🚀" onChange={onChange} />);

    const input = screen.getByLabelText('Custom emoji input');
    await user.type(input, '🌈');

    expect(onChange).toHaveBeenCalledWith('🌈');
  });

  it('does not call onChange for empty custom input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="🚀" onChange={onChange} />);

    const input = screen.getByLabelText('Custom emoji input');
    await user.type(input, '   '); // Whitespace only

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange when pressing Enter in custom input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="🚀" onChange={onChange} />);

    const input = screen.getByLabelText('Custom emoji input');
    await user.type(input, '🌈{Enter}');

    // Once per character typed, once on Enter
    expect(onChange).toHaveBeenCalledWith('🌈');
  });

  it('does not call onChange on Enter if custom input is empty', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="🚀" onChange={onChange} />);

    const input = screen.getByLabelText('Custom emoji input');
    await user.click(input);
    await user.keyboard('{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('clears custom input when preset emoji is selected', async () => {
    const user = userEvent.setup();
    render(<IconPicker value="🚀" onChange={vi.fn()} />);

    const input = screen.getByLabelText('Custom emoji input') as HTMLInputElement;
    await user.type(input, '🌈');
    expect(input.value).toBe('🌈');

    const presetEmoji = screen.getByRole('radio', { name: '🎯' });
    await user.click(presetEmoji);

    expect(input.value).toBe('');
  });

  it('shows helper text when custom value is entered', async () => {
    const user = userEvent.setup();
    render(<IconPicker value="🚀" onChange={vi.fn()} />);

    expect(
      screen.queryByText('Press Enter to confirm, or click a preset above')
    ).not.toBeInTheDocument();

    const input = screen.getByLabelText('Custom emoji input');
    await user.type(input, '🌈');

    expect(
      screen.getByText('Press Enter to confirm, or click a preset above')
    ).toBeInTheDocument();
  });

  it('applies custom className to container', () => {
    const { container } = render(
      <IconPicker value="🚀" onChange={vi.fn()} className="custom-class" />
    );

    const pickerContainer = container.querySelector('.custom-class');
    expect(pickerContainer).toBeInTheDocument();
  });

  it('renders label for custom input', () => {
    render(<IconPicker value="🚀" onChange={vi.fn()} />);

    const label = screen.getByText('Or type a custom emoji');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'custom-emoji');
  });

  it('displays all emojis in a 4-column grid', () => {
    const { container } = render(<IconPicker value="🚀" onChange={vi.fn()} />);

    const grid = container.querySelector('.grid.grid-cols-4');
    expect(grid).toBeInTheDocument();
  });

  it('handles multiple character emojis in custom input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IconPicker value="🚀" onChange={onChange} />);

    const input = screen.getByLabelText('Custom emoji input');
    await user.type(input, '👨‍💻'); // Multi-character emoji

    expect(onChange).toHaveBeenCalled();
  });
});
